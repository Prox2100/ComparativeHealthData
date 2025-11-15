/**
 * Hospital Price Comparison Application
 * Complete implementation with advanced filtering, sorting, and national average comparison
 */

// Application State
const AppState = {
    hospitalData: null,
    hospitalsArray: [],
    nationalAverages: {},
    selectedTargetHospitals: new Set(),
    selectedCompareHospitals: new Set(),
    currentResults: null,
    currentSort: {
        column: 'percentVariance',
        direction: 'desc'
    },
    procedureFilters: {
        serviceCategory: '',
        cptCode: '',
        shoppableService: ''
    },
    filters: {
        target: {
            state: '',
            city: '',
            zip: '',
            hospitalType: '',
            ownership: '',
            bedsMin: '',
            bedsMax: ''
        },
        compare: {
            state: '',
            city: '',
            zip: '',
            hospitalType: '',
            ownership: '',
            bedsMin: '',
            bedsMax: ''
        }
    },
    outlierLogic: {
        enabled: false,
        minHospitals: 3,
        minVolume: 5,
        stdDev: 2.0
    }
};

// DOM Elements
const DOM = {
    // Target hospital elements
    targetSearchInput: document.getElementById('target-hospital-search'),
    targetDropdown: document.getElementById('target-hospital-dropdown'),
    targetList: document.getElementById('target-hospital-list'),
    targetSelected: document.getElementById('target-selected-hospitals'),
    targetFilterToggle: document.getElementById('target-filter-toggle'),
    targetAdvancedFilters: document.getElementById('target-advanced-filters'),
    targetClearFilters: document.getElementById('target-clear-filters'),

    // Compare hospital elements
    compareSearchInput: document.getElementById('compare-hospital-search'),
    compareDropdown: document.getElementById('compare-hospital-dropdown'),
    compareList: document.getElementById('compare-hospital-list'),
    compareSelected: document.getElementById('compare-selected-hospitals'),
    compareFilterToggle: document.getElementById('compare-filter-toggle'),
    compareAdvancedFilters: document.getElementById('compare-advanced-filters'),
    compareClearFilters: document.getElementById('compare-clear-filters'),

    // Procedure elements
    procedureFilter: document.getElementById('procedure-filter'),
    procedureDropdown: document.getElementById('procedure-dropdown'),
    procedureList: document.getElementById('procedure-list'),
    serviceCategoryFilter: document.getElementById('service-category-filter'),
    shoppableServiceFilter: document.getElementById('shoppable-service-filter'),
    applyFiltersButton: document.getElementById('apply-filters-button'),
    clearAllFiltersButton: document.getElementById('clear-all-filters-button'),

    // Action buttons
    compareButton: document.getElementById('compare-button'),
    resetButton: document.getElementById('reset-button'),

    // Results elements
    loadingState: document.getElementById('loading-state'),
    emptyState: document.getElementById('empty-state'),
    resultsContent: document.getElementById('results-content'),
    exportCsv: document.getElementById('export-csv'),
    exportPdf: document.getElementById('export-pdf'),
    procedureTable: document.getElementById('procedure-table'),

    // Outlier logic elements
    outlierToggle: document.getElementById('outlier-toggle'),
    outlierControls: document.getElementById('outlier-controls'),
    minHospitals: document.getElementById('min-hospitals'),
    minVolume: document.getElementById('min-volume'),
    stdDev: document.getElementById('std-dev')
};

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing Hospital Price Comparison App...');

    try {
        showMessage('Loading hospital data...');
        await loadHospitalData();

        initializeAdvancedFilters();
        setupEventListeners();
        calculateNationalAverages();
        initSaveLoadFeatures();

        console.log('App initialized successfully!');
        hideMessage();
    } catch (error) {
        console.error('Error initializing app:', error);
        showMessage('Failed to load hospital data. Please refresh the page.', 'error');
    }
}

/**
 * Load hospital data from chunked JSON files
 */
async function loadHospitalData() {
    try {
        console.log('[DEBUG] Starting to fetch hospital data in chunks...');

        const loadingMsg = document.getElementById('loadingMessage');
        if (loadingMsg) {
            loadingMsg.textContent = 'Loading hospital data in chunks...';
        }

        // Load the index to know how many chunks we have
        console.log('[DEBUG] Loading chunk index...');
        const indexResponse = await fetch('data/chunks/index.json');
        if (!indexResponse.ok) {
            throw new Error('Failed to load chunk index');
        }
        const index = await indexResponse.json();

        console.log(`[DEBUG] Found ${index.chunks.length} chunks with ${index.total_hospitals} total hospitals`);

        // Load metadata
        if (loadingMsg) {
            loadingMsg.textContent = 'Loading metadata...';
        }
        console.log('[DEBUG] Loading metadata...');
        const metadataResponse = await fetch('data/chunks/metadata.json');
        if (!metadataResponse.ok) {
            throw new Error('Failed to load metadata');
        }
        const metadata = await metadataResponse.json();

        // Initialize hospital data structure
        AppState.hospitalData = {
            hospitals: {},
            ...metadata
        };

        // Load chunks progressively
        console.log('[DEBUG] Loading hospital chunks...');
        for (let i = 0; i < index.chunks.length; i++) {
            const chunkInfo = index.chunks[i];
            const chunkNum = i + 1;
            const totalChunks = index.chunks.length;

            if (loadingMsg) {
                loadingMsg.textContent = `Loading hospitals: chunk ${chunkNum}/${totalChunks} (${chunkInfo.hospitals} hospitals, ${chunkInfo.size_mb}MB)`;
            }

            console.log(`[DEBUG] Loading chunk ${chunkNum}/${totalChunks}: ${chunkInfo.file}`);

            const chunkResponse = await fetch(`data/chunks/${chunkInfo.file}`);
            if (!chunkResponse.ok) {
                throw new Error(`Failed to load chunk ${chunkInfo.file}`);
            }

            const chunkData = await chunkResponse.json();

            // Merge chunk into main hospitals object
            Object.assign(AppState.hospitalData.hospitals, chunkData);

            console.log(`[DEBUG] Loaded chunk ${chunkNum}/${totalChunks}, total hospitals so far: ${Object.keys(AppState.hospitalData.hospitals).length}`);
        }

        if (loadingMsg) {
            loadingMsg.textContent = 'Building search index... Almost done...';
        }

        console.log('[DEBUG] Building hospital array and search index...');

        // Convert to array and sort
        AppState.hospitalsArray = Object.values(AppState.hospitalData.hospitals)
            .map(h => ({
                ...h,
                searchText: `${h.name} ${h.provnum} ${h.city} ${h.state}`.toLowerCase()
            }))
            .sort((a, b) => (b.net_patient_revenue || 0) - (a.net_patient_revenue || 0));

        console.log(`[INFO] Successfully loaded data for ${AppState.hospitalsArray.length} hospitals`);
    } catch (error) {
        console.error('Error loading hospital data:', error);
        throw error;
    }
}

/**
 * Calculate national averages for all procedures
 */
function calculateNationalAverages() {
    console.log('Calculating national averages...');

    const procedureStats = {};

    // Aggregate data from all hospitals
    AppState.hospitalsArray.forEach(hospital => {
        Object.entries(hospital.procedures).forEach(([code, data]) => {
            if (!procedureStats[code]) {
                procedureStats[code] = {
                    totalCharge: 0,
                    totalVolume: 0,
                    hospitalCount: 0
                };
            }

            procedureStats[code].totalCharge += data.avg_charge;
            procedureStats[code].totalVolume += data.volume;
            procedureStats[code].hospitalCount++;
        });
    });

    // Calculate averages
    Object.entries(procedureStats).forEach(([code, stats]) => {
        AppState.nationalAverages[code] = {
            avgCharge: stats.totalCharge / stats.hospitalCount,
            totalVolume: stats.totalVolume,
            hospitalCount: stats.hospitalCount
        };
    });

    console.log(`Calculated national averages for ${Object.keys(AppState.nationalAverages).length} procedures`);
}

/**
 * Initialize advanced filters
 */
function initializeAdvancedFilters() {
    // Collect unique values for dropdowns
    const states = new Set();
    const hospitalTypes = new Set();
    const ownerships = new Set();

    AppState.hospitalsArray.forEach(h => {
        if (h.state) states.add(h.state);
        if (h.hospital_type) hospitalTypes.add(h.hospital_type);
        if (h.ownership) ownerships.add(h.ownership);
    });

    // Populate state dropdowns
    const stateOptions = Array.from(states).sort().map(s => `<option value="${s}">${s}</option>`).join('');
    document.getElementById('target-state').innerHTML += stateOptions;
    document.getElementById('compare-state').innerHTML += stateOptions;

    // Populate hospital type dropdowns
    const typeOptions = Array.from(hospitalTypes).sort().map(t => `<option value="${t}">${t}</option>`).join('');
    document.getElementById('target-hospital-type').innerHTML += typeOptions;
    document.getElementById('compare-hospital-type').innerHTML += typeOptions;

    // Populate ownership dropdowns
    const ownerOptions = Array.from(ownerships).sort().map(o => `<option value="${o}">${o}</option>`).join('');
    document.getElementById('target-ownership').innerHTML += ownerOptions;
    document.getElementById('compare-ownership').innerHTML += ownerOptions;

    // Populate service categories dropdown (from loaded data)
    if (AppState.hospitalData.service_categories && AppState.hospitalData.service_categories.length > 0) {
        const categoryOptions = AppState.hospitalData.service_categories
            .map(cat => `<option value="${cat}">${cat}</option>`)
            .join('');
        const serviceCategorySelect = document.getElementById('service-category-filter');
        if (serviceCategorySelect) {
            serviceCategorySelect.innerHTML = '<option value="">All Categories</option>' + categoryOptions;
        }
        console.log(`Loaded ${AppState.hospitalData.service_categories.length} service categories`);
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Target hospital search
    DOM.targetSearchInput.addEventListener('input', debounce((e) => {
        console.log('Target search input:', e.target.value);
        filterHospitals(e.target.value, 'target');
    }, 150));

    DOM.targetSearchInput.addEventListener('focus', () => {
        console.log('Target search focused');
        DOM.targetDropdown.classList.remove('hidden');
        filterHospitals(DOM.targetSearchInput.value, 'target');
    });

    // Compare hospital search
    DOM.compareSearchInput.addEventListener('input', debounce((e) => {
        filterHospitals(e.target.value, 'compare');
    }, 150));

    DOM.compareSearchInput.addEventListener('focus', () => {
        DOM.compareDropdown.classList.remove('hidden');
        filterHospitals(DOM.compareSearchInput.value, 'compare');
    });

    // Procedure filter
    DOM.procedureFilter.addEventListener('input', debounce((e) => {
        filterProcedures(e.target.value);
    }, 150));

    DOM.procedureFilter.addEventListener('focus', () => {
        DOM.procedureDropdown.classList.remove('hidden');
        filterProcedures(DOM.procedureFilter.value);
    });

    // Apply Filters button
    DOM.applyFiltersButton.addEventListener('click', () => {
        applyProcedureFilters();
    });

    // Clear All Filters button
    DOM.clearAllFiltersButton.addEventListener('click', () => {
        clearProcedureFilters();
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multi-select-wrapper') && !e.target.closest('#procedure-filter')) {
            DOM.targetDropdown.classList.add('hidden');
            DOM.compareDropdown.classList.add('hidden');
            DOM.procedureDropdown.classList.add('hidden');
        }
    });

    // Filter toggles
    DOM.targetFilterToggle.addEventListener('click', () => toggleFilters('target'));
    DOM.compareFilterToggle.addEventListener('click', () => toggleFilters('compare'));

    // Clear filter buttons
    DOM.targetClearFilters.addEventListener('click', () => clearFilters('target'));
    DOM.compareClearFilters.addEventListener('click', () => clearFilters('compare'));

    // Advanced filter changes
    setupAdvancedFilterListeners('target');
    setupAdvancedFilterListeners('compare');

    // Outlier logic controls
    DOM.outlierToggle.addEventListener('change', () => {
        AppState.outlierLogic.enabled = DOM.outlierToggle.checked;
        if (AppState.outlierLogic.enabled) {
            DOM.outlierControls.classList.remove('hidden');
            DOM.outlierControls.style.display = 'flex';
        } else {
            DOM.outlierControls.classList.add('hidden');
            DOM.outlierControls.style.display = 'none';
        }
    });

    DOM.minHospitals.addEventListener('input', () => {
        const value = parseInt(DOM.minHospitals.value);
        if (!isNaN(value) && value > 0) {
            AppState.outlierLogic.minHospitals = value;
        }
    });

    DOM.minVolume.addEventListener('input', () => {
        const value = parseInt(DOM.minVolume.value);
        if (!isNaN(value) && value > 0) {
            AppState.outlierLogic.minVolume = value;
        }
    });

    DOM.stdDev.addEventListener('input', () => {
        const value = parseFloat(DOM.stdDev.value);
        if (!isNaN(value) && value >= 0.5 && value <= 5) {
            AppState.outlierLogic.stdDev = value;
        }
    });

    // Action buttons
    DOM.compareButton.addEventListener('click', () => {
        performComparison();
        scrollToTop();
    });
    DOM.resetButton.addEventListener('click', () => {
        resetForm();
        scrollToTop();
    });

    // Export buttons
    DOM.exportCsv.addEventListener('click', exportToCSV);
    DOM.exportPdf.addEventListener('click', () => window.print());

    // Table sorting
    setupTableSorting();

    // Tab switching
    setupTabSwitching();
}

/**
 * Setup advanced filter listeners for a filter type
 */
function setupAdvancedFilterListeners(type) {
    const prefix = type;

    ['state', 'city', 'zip', 'hospital-type', 'ownership', 'beds-min', 'beds-max'].forEach(filter => {
        const element = document.getElementById(`${prefix}-${filter}`);
        if (element) {
            element.addEventListener('change', () => updateFilterState(type));
            element.addEventListener('input', debounce(() => updateFilterState(type), 150));
        }
    });
}

/**
 * Update filter state and re-filter hospitals
 */
function updateFilterState(type) {
    const prefix = type;

    AppState.filters[type] = {
        state: document.getElementById(`${prefix}-state`).value,
        city: document.getElementById(`${prefix}-city`).value,
        zip: document.getElementById(`${prefix}-zip`).value,
        hospitalType: document.getElementById(`${prefix}-hospital-type`).value,
        ownership: document.getElementById(`${prefix}-ownership`).value,
        bedsMin: document.getElementById(`${prefix}-beds-min`).value,
        bedsMax: document.getElementById(`${prefix}-beds-max`).value
    };

    // Update filter count badge
    updateFilterCountBadge(type);

    // Re-filter hospitals with current search query
    const searchInput = type === 'target' ? DOM.targetSearchInput : DOM.compareSearchInput;
    filterHospitals(searchInput.value, type);
}

/**
 * Update the filter count badge
 */
function updateFilterCountBadge(type) {
    const filters = AppState.filters[type];
    const count = Object.values(filters).filter(v => v !== '').length;
    const badge = document.getElementById(`${type}-filter-count`);

    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * Toggle filter section visibility
 */
function toggleFilters(type) {
    const toggle = type === 'target' ? DOM.targetFilterToggle : DOM.compareFilterToggle;
    const filters = type === 'target' ? DOM.targetAdvancedFilters : DOM.compareAdvancedFilters;

    toggle.classList.toggle('active');
    filters.classList.toggle('hidden');
}

/**
 * Clear all advanced filters for a type
 */
function clearFilters(type) {
    const prefix = type;

    document.getElementById(`${prefix}-state`).value = '';
    document.getElementById(`${prefix}-city`).value = '';
    document.getElementById(`${prefix}-zip`).value = '';
    document.getElementById(`${prefix}-hospital-type`).value = '';
    document.getElementById(`${prefix}-ownership`).value = '';
    document.getElementById(`${prefix}-beds-min`).value = '';
    document.getElementById(`${prefix}-beds-max`).value = '';

    updateFilterState(type);
    updateFilterCountBadge(type);
}

/**
 * Debounce function for performance optimization
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Filter hospitals based on search query and advanced filters
 */
function filterHospitals(query, type) {
    const dropdown = type === 'target' ? DOM.targetList : DOM.compareList;
    const selectedSet = type === 'target' ? AppState.selectedTargetHospitals : AppState.selectedCompareHospitals;
    const filters = AppState.filters[type];

    const searchQuery = query.toLowerCase().trim();

    // Apply text search and advanced filters
    let filtered = AppState.hospitalsArray;

    // Apply advanced filters first
    filtered = filtered.filter(h => {
        if (filters.state && h.state !== filters.state) return false;
        if (filters.city && !h.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
        if (filters.zip && h.zip_code !== filters.zip) return false;
        if (filters.hospitalType && h.hospital_type !== filters.hospitalType) return false;
        if (filters.ownership && h.ownership !== filters.ownership) return false;
        if (filters.bedsMin && h.beds_total < parseInt(filters.bedsMin)) return false;
        if (filters.bedsMax && h.beds_total > parseInt(filters.bedsMax)) return false;
        return true;
    });

    // Apply text search
    if (searchQuery !== '') {
        filtered = filtered.filter(h => h.searchText.includes(searchQuery));
    }

    // Limit results for performance
    filtered = filtered.slice(0, searchQuery === '' ? 100 : 50);

    renderHospitalDropdown(filtered, dropdown, selectedSet, type);
}

/**
 * Render hospital dropdown items
 */
function renderHospitalDropdown(hospitals, container, selectedSet, type) {
    const fragment = document.createDocumentFragment();

    if (hospitals.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'dropdown-empty';
        empty.textContent = 'No hospitals found';
        fragment.appendChild(empty);
    } else {
        hospitals.forEach(hospital => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            if (selectedSet.has(hospital.provnum)) {
                item.classList.add('selected');
            }

            const nameDiv = document.createElement('div');
            nameDiv.className = 'dropdown-item-name';
            nameDiv.textContent = `${hospital.name}`;

            const provnumDiv = document.createElement('div');
            provnumDiv.className = 'dropdown-item-provnum';
            provnumDiv.textContent = `${hospital.provnum} • ${hospital.city}, ${hospital.state}`;

            item.appendChild(nameDiv);
            item.appendChild(provnumDiv);

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleHospitalSelection(hospital, type);
            });

            fragment.appendChild(item);
        });
    }

    container.innerHTML = '';
    container.appendChild(fragment);
}

/**
 * Toggle hospital selection
 */
function toggleHospitalSelection(hospital, type) {
    const selectedSet = type === 'target' ? AppState.selectedTargetHospitals : AppState.selectedCompareHospitals;
    const searchInput = type === 'target' ? DOM.targetSearchInput : DOM.compareSearchInput;

    if (selectedSet.has(hospital.provnum)) {
        selectedSet.delete(hospital.provnum);
    } else {
        selectedSet.add(hospital.provnum);
    }

    renderSelectedHospitals(type);
    searchInput.value = '';
    filterHospitals('', type);
}

/**
 * Render selected hospitals
 */
function renderSelectedHospitals(type) {
    const selectedSet = type === 'target' ? AppState.selectedTargetHospitals : AppState.selectedCompareHospitals;
    const container = type === 'target' ? DOM.targetSelected : DOM.compareSelected;

    const fragment = document.createDocumentFragment();

    selectedSet.forEach(provnum => {
        const hospital = AppState.hospitalData.hospitals[provnum];
        if (!hospital) return;

        const item = document.createElement('div');
        item.className = 'selected-item';

        const name = document.createElement('span');
        name.className = 'selected-item-name';
        name.textContent = `${hospital.name} (${hospital.provnum})`;
        name.title = `${hospital.name} (${hospital.provnum})`;

        const remove = document.createElement('span');
        remove.className = 'selected-item-remove';
        remove.innerHTML = '&times;';
        remove.addEventListener('click', () => {
            toggleHospitalSelection(hospital, type);
        });

        item.appendChild(name);
        item.appendChild(remove);
        fragment.appendChild(item);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
}

/**
 * Filter procedures based on search query
 */
function filterProcedures(query) {
    const searchQuery = query.trim().toUpperCase();

    if (searchQuery === '') {
        DOM.procedureDropdown.classList.add('hidden');
        return;
    }

    DOM.procedureDropdown.classList.remove('hidden');

    const filtered = AppState.hospitalData.procedure_codes
        .filter(code => code.toUpperCase().includes(searchQuery))
        .slice(0, 30);

    renderProcedureDropdown(filtered);
}

/**
 * Render procedure dropdown
 */
function renderProcedureDropdown(procedures) {
    const fragment = document.createDocumentFragment();

    if (procedures.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'dropdown-empty';
        empty.textContent = 'No procedures found';
        fragment.appendChild(empty);
    } else {
        procedures.forEach(code => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';

            const codeDiv = document.createElement('div');
            codeDiv.className = 'procedure-code';
            codeDiv.textContent = code;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'procedure-name';
            nameDiv.textContent = AppState.hospitalData.procedure_names[code] || 'Unknown Procedure';

            item.appendChild(codeDiv);
            item.appendChild(nameDiv);

            item.addEventListener('click', () => {
                DOM.procedureFilter.value = code;
                DOM.procedureDropdown.classList.add('hidden');
            });

            fragment.appendChild(item);
        });
    }

    DOM.procedureList.innerHTML = '';
    DOM.procedureList.appendChild(fragment);
}

/**
 * Parse CPT/HCPCS filter input - supports ranges (80053-80075) and multiple codes (99281, 99291)
 */
function parseCptFilter(input) {
    if (!input || input.trim() === '') return null;

    const parts = input.split(',').map(p => p.trim()).filter(p => p);
    const codes = new Set();

    parts.forEach(part => {
        // Check for range (e.g., 80053-80075)
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(s => s.trim());
            if (start && end) {
                // Extract numeric part
                const startNum = parseInt(start.match(/\d+/)?.[0] || '0');
                const endNum = parseInt(end.match(/\d+/)?.[0] || '0');

                if (startNum && endNum && startNum <= endNum) {
                    // Generate all codes in range
                    for (let i = startNum; i <= endNum; i++) {
                        codes.add(i.toString());
                    }
                }
            }
        } else {
            // Single code
            codes.add(part.toUpperCase());
        }
    });

    return codes.size > 0 ? codes : null;
}

/**
 * Apply procedure filters
 */
function applyProcedureFilters() {
    AppState.procedureFilters.serviceCategory = DOM.serviceCategoryFilter.value;
    AppState.procedureFilters.cptCode = DOM.procedureFilter.value;
    AppState.procedureFilters.shoppableService = DOM.shoppableServiceFilter.value;

    console.log('Applied procedure filters:', AppState.procedureFilters);

    // If there are selected hospitals, re-run the comparison
    if (AppState.selectedTargetHospitals.size > 0 ||
        Object.values(AppState.filters.target).some(v => v !== '')) {
        performComparison();
    }
}

/**
 * Clear all procedure filters
 */
function clearProcedureFilters() {
    DOM.serviceCategoryFilter.value = '';
    DOM.procedureFilter.value = '';
    DOM.shoppableServiceFilter.value = '';

    AppState.procedureFilters.serviceCategory = '';
    AppState.procedureFilters.cptCode = '';
    AppState.procedureFilters.shoppableService = '';

    DOM.procedureDropdown.classList.add('hidden');

    console.log('Cleared all procedure filters');
}

/**
 * Perform price comparison
 */
function getFilteredHospitals(type) {
    const filters = AppState.filters[type];
    return AppState.hospitalsArray.filter(h => {
        if (filters.state && h.state !== filters.state) return false;
        if (filters.city && !h.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
        if (filters.zip && h.zip_code !== filters.zip) return false;
        if (filters.hospitalType && h.hospital_type !== filters.hospitalType) return false;
        if (filters.ownership && h.ownership !== filters.ownership) return false;
        if (filters.bedsMin && h.beds_total < parseInt(filters.bedsMin)) return false;
        if (filters.bedsMax && h.beds_total > parseInt(filters.bedsMax)) return false;
        return true;
    });
}

function getFilterDescription(filters, hospitalCount) {
    const parts = [];
    if (filters.state) parts.push(`State: ${filters.state}`);
    if (filters.city) parts.push(`City: ${filters.city}`);
    if (filters.zip) parts.push(`Zip: ${filters.zip}`);
    if (filters.hospitalType) parts.push(filters.hospitalType);
    if (filters.ownership) parts.push(filters.ownership);
    if (filters.bedsMin || filters.bedsMax) {
        const range = filters.bedsMin && filters.bedsMax
            ? `${filters.bedsMin}-${filters.bedsMax} beds`
            : filters.bedsMin
                ? `${filters.bedsMin}+ beds`
                : `≤${filters.bedsMax} beds`;
        parts.push(range);
    }

    if (parts.length === 0) {
        return `${hospitalCount} ${hospitalCount === 1 ? 'Hospital' : 'Hospitals'}`;
    }

    return `${parts.join(' • ')} (${hospitalCount} ${hospitalCount === 1 ? 'Hospital' : 'Hospitals'})`;
}

async function performComparison() {
    // Check if user has either selected hospitals OR applied filters for target
    const targetHasSelection = AppState.selectedTargetHospitals.size > 0;
    const targetHasFilters = Object.values(AppState.filters.target).some(v => v !== '');

    if (!targetHasSelection && !targetHasFilters) {
        alert('Please select at least one target hospital or apply filters');
        return;
    }

    // Get target hospitals - either selected or filtered
    let targetProvnums;
    let targetDescription;
    if (targetHasSelection) {
        targetProvnums = Array.from(AppState.selectedTargetHospitals);
        targetDescription = null; // Will use default hospital names
    } else {
        // Use all hospitals matching the filters
        const filteredHospitals = getFilteredHospitals('target');
        if (filteredHospitals.length === 0) {
            alert('No hospitals match the target filters');
            return;
        }
        targetProvnums = filteredHospitals.map(h => h.provnum);
        targetDescription = getFilterDescription(AppState.filters.target, filteredHospitals.length);
    }

    // Get comparison hospitals - either selected, filtered, or national average
    const compareHasSelection = AppState.selectedCompareHospitals.size > 0;
    const compareHasFilters = Object.values(AppState.filters.compare).some(v => v !== '');

    let compareProvnums;
    let compareDescription;
    let useNationalAverage = false;

    if (compareHasSelection) {
        compareProvnums = Array.from(AppState.selectedCompareHospitals);
        compareDescription = null; // Will use default hospital names
    } else if (compareHasFilters) {
        // Use all hospitals matching the comparison filters
        const filteredHospitals = getFilteredHospitals('compare');
        if (filteredHospitals.length === 0) {
            alert('No hospitals match the comparison filters');
            return;
        }
        compareProvnums = filteredHospitals.map(h => h.provnum);
        compareDescription = getFilterDescription(AppState.filters.compare, filteredHospitals.length);
    } else {
        // No selection and no filters - use national average
        useNationalAverage = true;
        compareProvnums = [];
        compareDescription = 'National Average';
    }

    showLoadingState();

    setTimeout(() => {
        try {
            const results = calculateComparison(
                targetProvnums,
                compareProvnums,
                AppState.procedureFilters,
                useNationalAverage,
                targetDescription,
                compareDescription
            );

            displayResults(results);
        } catch (error) {
            console.error('Error performing comparison:', error);
            console.error('Error stack:', error.stack);
            alert(`An error occurred during comparison: ${error.message}\n\nPlease check the console for details.`);
            hideLoadingState();
        }
    }, 100);
}

/**
 * Apply outlier logic filters to hospitals for a specific procedure code
 * Returns filtered hospitals that pass all outlier criteria
 */
function applyOutlierFilters(hospitals, code, outlierSettings) {
    if (!outlierSettings.enabled) {
        return hospitals; // No filtering if outlier logic is disabled
    }

    // Step 1: Filter by minimum volume
    let filteredHospitals = hospitals.filter(hospital => {
        const proc = hospital.procedures[code];
        return proc && proc.volume >= outlierSettings.minVolume;
    });

    // Step 2: Check minimum hospitals requirement
    if (filteredHospitals.length < outlierSettings.minHospitals) {
        return []; // Not enough hospitals, exclude this procedure entirely
    }

    // Step 3: Apply standard deviation filter
    // Calculate mean and standard deviation of charges
    const charges = filteredHospitals
        .map(hospital => hospital.procedures[code].avg_charge)
        .filter(charge => charge != null && charge > 0);

    if (charges.length === 0) {
        return [];
    }

    // Calculate mean
    const mean = charges.reduce((sum, charge) => sum + charge, 0) / charges.length;

    // Calculate standard deviation
    const squaredDiffs = charges.map(charge => Math.pow(charge - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / charges.length;
    const stdDev = Math.sqrt(variance);

    // Filter hospitals outside the acceptable range
    const lowerBound = mean - (outlierSettings.stdDev * stdDev);
    const upperBound = mean + (outlierSettings.stdDev * stdDev);

    filteredHospitals = filteredHospitals.filter(hospital => {
        const proc = hospital.procedures[code];
        if (!proc || proc.avg_charge == null) return false;
        return proc.avg_charge >= lowerBound && proc.avg_charge <= upperBound;
    });

    return filteredHospitals;
}

/**
 * Calculate price comparison
 */
function calculateComparison(targetProvnums, compareProvnums, procedureFilters, useNationalAverage, targetDescription, compareDescription) {
    const targetHospitals = targetProvnums.map(pn => AppState.hospitalData.hospitals[pn]).filter(h => h != null);
    const compareHospitals = compareProvnums.map(pn => AppState.hospitalData.hospitals[pn]).filter(h => h != null);

    // Get all procedures from target hospitals
    const allProcedureCodes = new Set();
    targetHospitals.forEach(hospital => {
        if (hospital.procedures) {
            Object.keys(hospital.procedures).forEach(code => allProcedureCodes.add(code));
        }
    });

    // Apply procedure filters if specified
    let proceduresToCompare = Array.from(allProcedureCodes);

    if (proceduresToCompare.length === 0) {
        throw new Error('No procedures found in target hospitals. Please select different hospitals.');
    }

    // Filter by CPT/HCPCS code - supports ranges and multiple codes
    if (procedureFilters.cptCode) {
        const parsedCodes = parseCptFilter(procedureFilters.cptCode);
        if (parsedCodes) {
            proceduresToCompare = proceduresToCompare.filter(code => {
                // Check exact match or partial match
                return parsedCodes.has(code) ||
                       Array.from(parsedCodes).some(filterCode =>
                           code.toUpperCase().includes(filterCode)
                       );
            });
        }
    }

    // Filter by service category
    if (procedureFilters.serviceCategory) {
        proceduresToCompare = proceduresToCompare.filter(code => {
            const category = AppState.hospitalData.service_category_map[code];
            return category === procedureFilters.serviceCategory;
        });
    }

    // Filter by shoppable service
    if (procedureFilters.shoppableService) {
        proceduresToCompare = proceduresToCompare.filter(code => {
            const shoppable = AppState.hospitalData.shoppable_map[code];
            if (procedureFilters.shoppableService === 'yes') {
                return shoppable === 'Y';
            } else if (procedureFilters.shoppableService === 'no') {
                return shoppable === 'N';
            }
            return true;
        });
    }

    // Calculate comparison metrics
    const procedureComparisons = [];
    let targetTotalRevenue = 0;
    let compareTotalRevenue = 0;
    let targetTotalVolume = 0;

    proceduresToCompare.forEach(code => {
        // Calculate target averages
        let targetAvgCharge = 0;
        let targetTotalVol = 0;
        let targetCount = 0;

        targetHospitals.forEach(hospital => {
            const proc = hospital.procedures[code];
            if (proc && proc.volume > 0) {
                targetAvgCharge += proc.avg_charge;
                targetTotalVol += proc.volume;
                targetCount++;
            }
        });

        if (targetCount === 0) return;

        targetAvgCharge = targetAvgCharge / targetCount;

        // Calculate comparison averages
        let compareAvgCharge, compareTotalVol, compareCount;

        if (useNationalAverage) {
            // Use national average
            const nationalAvg = AppState.nationalAverages[code];
            if (!nationalAvg) return;

            compareAvgCharge = nationalAvg.avgCharge;
            compareTotalVol = nationalAvg.totalVolume;
            compareCount = nationalAvg.hospitalCount;
        } else {
            // Use selected hospitals - calculate weighted average with outlier filtering
            // Apply outlier logic filters if enabled
            const filteredCompareHospitals = applyOutlierFilters(compareHospitals, code, AppState.outlierLogic);

            // If outlier logic filtered out all hospitals or didn't meet min hospitals, skip this procedure
            if (filteredCompareHospitals.length === 0) return;

            let compareTotalCharges = 0;
            compareTotalVol = 0;
            compareCount = 0;

            filteredCompareHospitals.forEach(hospital => {
                const proc = hospital.procedures[code];
                if (proc && proc.volume > 0) {
                    compareTotalCharges += proc.avg_charge * proc.volume;  // Total charges
                    compareTotalVol += proc.volume;
                    compareCount++;
                }
            });

            if (compareCount === 0) return;

            // Weighted average: SUM(Peer Total Charges) / SUM(Peer Volume)
            compareAvgCharge = compareTotalVol > 0 ? compareTotalCharges / compareTotalVol : 0;
        }

        // Calculate metrics
        const difference = targetAvgCharge - compareAvgCharge;
        const percentVariance = compareAvgCharge > 0
            ? ((difference / compareAvgCharge) * 100)
            : 0;

        const targetRevenue = targetAvgCharge * targetTotalVol;
        const compareRevenue = compareAvgCharge * targetTotalVol;

        procedureComparisons.push({
            code,
            name: AppState.hospitalData.procedure_names[code] || 'Unknown Procedure',
            targetAvgCharge,
            targetVolume: targetTotalVol,
            targetRevenue,
            compareAvgCharge,
            compareVolume: compareTotalVol,
            compareRevenue,
            hospitalsCount: compareCount,
            difference,
            percentVariance
        });

        targetTotalRevenue += targetRevenue;
        compareTotalRevenue += compareRevenue;
        targetTotalVolume += targetTotalVol;
    });

    // Calculate overall metrics
    const overallDifference = targetTotalRevenue - compareTotalRevenue;
    const overallVariance = compareTotalRevenue > 0
        ? ((overallDifference / compareTotalRevenue) * 100)
        : 0;

    // Sort by current sort settings
    sortProcedureComparisons(procedureComparisons);

    return {
        targetHospitals,
        compareHospitals,
        useNationalAverage,
        targetDescription,
        compareDescription,
        procedureComparisons,
        overall: {
            targetTotalRevenue,
            compareTotalRevenue,
            difference: overallDifference,
            variance: overallVariance,
            procedureCount: procedureComparisons.length,
            targetVolume: targetTotalVolume
        },
        // Store comparison filters for state market position calculation
        compareFilters: { ...AppState.filters.compare }
    };
}

/**
 * Display comparison results
 */
function displayResults(results) {
    AppState.currentResults = results;

    DOM.loadingState.classList.add('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.resultsContent.classList.remove('hidden');

    // Update summary cards - use custom descriptions if provided
    let targetDisplay, compareDisplay;

    if (results.targetDescription) {
        targetDisplay = results.targetDescription;
    } else {
        const targetNames = results.targetHospitals.map(h => h.name).join(', ');
        targetDisplay = results.targetHospitals.length === 1
            ? targetNames
            : `${results.targetHospitals.length} ${results.targetHospitals.length === 1 ? 'Hospital' : 'Hospitals'}`;
    }

    if (results.compareDescription) {
        compareDisplay = results.compareDescription;
    } else if (results.useNationalAverage) {
        compareDisplay = 'National Average';
    } else {
        const compareNames = results.compareHospitals.map(h => h.name).join(', ');
        compareDisplay = results.compareHospitals.length === 1
            ? compareNames
            : `${results.compareHospitals.length} ${results.compareHospitals.length === 1 ? 'Hospital' : 'Hospitals'}`;
    }

    document.getElementById('target-name').textContent = targetDisplay;
    document.getElementById('compare-name').textContent = compareDisplay;

    displayOverallMetrics(results);
    displayProcedureTable(results);
    displayHospitalTable(results);
    displayCategoryTable(results);
    displayBreakdownTable(results);
}

/**
 * Calculate state market position
 * ALWAYS compares target hospitals against ALL hospitals in the same state(s)
 * This calculation is independent of peer selection and advanced filters
 * Uses ALL target procedures, not just those matching peer hospitals
 */
function calculateStateMarketPosition(results) {
    // Get all unique states from target hospitals
    const targetStates = new Set();
    results.targetHospitals.forEach(hospital => {
        if (hospital.state) {
            targetStates.add(hospital.state);
        }
    });

    if (targetStates.size === 0) {
        console.log('[State Market Position] No target states found');
        return 0;
    }

    // ALWAYS use ALL hospitals in the target state(s), regardless of peer selection or filters
    const stateHospitals = AppState.hospitalsArray.filter(h =>
        targetStates.has(h.state) && h.procedures
    );

    if (stateHospitals.length === 0) {
        console.log('[State Market Position] No hospitals found in target states');
        return 0;
    }

    console.log(`[State Market Position] Comparing against ${stateHospitals.length} hospitals in state(s): ${Array.from(targetStates).join(', ')}`);

    // Get ALL procedures from target hospitals (not just those matching peers)
    const allTargetProcedures = new Map(); // code -> {totalCharge, totalVolume}

    results.targetHospitals.forEach(hospital => {
        if (hospital.procedures) {
            Object.entries(hospital.procedures).forEach(([code, procData]) => {
                if (procData.volume > 0 && procData.avg_charge != null) {
                    if (!allTargetProcedures.has(code)) {
                        allTargetProcedures.set(code, {
                            totalCharge: 0,
                            totalVolume: 0
                        });
                    }
                    const existing = allTargetProcedures.get(code);
                    existing.totalCharge += procData.avg_charge * procData.volume;
                    existing.totalVolume += procData.volume;
                }
            });
        }
    });

    console.log(`[State Market Position] Using ${allTargetProcedures.size} procedures from target hospital(s)`);

    // Calculate state average using volume-weighted methodology
    let stateWeightedRevenue = 0;
    let stateWeightedVolume = 0;
    let targetWeightedRevenue = 0;
    let targetWeightedVolume = 0;

    allTargetProcedures.forEach((targetData, code) => {
        // Apply outlier filtering to state hospitals for this procedure
        const filteredStateHospitals = applyOutlierFilters(stateHospitals, code, AppState.outlierLogic);

        // Calculate simple average of charges for this procedure across state hospitals
        let totalCharge = 0;
        let hospitalCount = 0;

        filteredStateHospitals.forEach(hospital => {
            const hospitalProc = hospital.procedures[code];
            if (hospitalProc && hospitalProc.volume > 0 && hospitalProc.avg_charge != null) {
                totalCharge += hospitalProc.avg_charge;
                hospitalCount++;
            }
        });

        if (hospitalCount > 0) {
            const stateAvgForProc = totalCharge / hospitalCount;
            const targetAvgForProc = targetData.totalCharge / targetData.totalVolume;

            // Weight by target volume for this procedure
            stateWeightedRevenue += stateAvgForProc * targetData.totalVolume;
            stateWeightedVolume += targetData.totalVolume;
            targetWeightedRevenue += targetAvgForProc * targetData.totalVolume;
            targetWeightedVolume += targetData.totalVolume;
        }
    });

    if (stateWeightedVolume === 0 || targetWeightedVolume === 0) {
        console.log('[State Market Position] Insufficient volume data');
        return 0;
    }

    const stateAvgCharge = stateWeightedRevenue / stateWeightedVolume;
    const targetAvgCharge = targetWeightedRevenue / targetWeightedVolume;

    if (stateAvgCharge === 0) {
        console.log('[State Market Position] State average charge is 0');
        return 0;
    }

    // Calculate variance: (target - state) / state * 100
    const variance = ((targetAvgCharge - stateAvgCharge) / stateAvgCharge) * 100;

    console.log(`[State Market Position] Target avg: $${targetAvgCharge.toFixed(2)}, State avg: $${stateAvgCharge.toFixed(2)}, Variance: ${variance.toFixed(2)}%`);

    return variance;
}

/**
 * Calculate national market position
 * ALWAYS compares target hospitals against ALL hospitals nationally
 * This calculation is independent of peer selection and advanced filters
 * Uses ALL target procedures, not just those matching peer hospitals
 * Uses pre-calculated national averages for efficiency
 */
function calculateNationalMarketPosition(results) {
    // ALWAYS use ALL hospitals nationally, regardless of peer selection or filters
    const nationalHospitals = AppState.hospitalsArray.filter(h => h.procedures);

    if (nationalHospitals.length === 0) {
        console.log('[National Market Position] No hospitals with procedures found');
        return 0;
    }

    console.log(`[National Market Position] Comparing against ${nationalHospitals.length} hospitals nationally`);

    // Get ALL procedures from target hospitals (not just those matching peers)
    const allTargetProcedures = new Map(); // code -> {totalCharge, totalVolume}

    results.targetHospitals.forEach(hospital => {
        if (hospital.procedures) {
            Object.entries(hospital.procedures).forEach(([code, procData]) => {
                if (procData.volume > 0 && procData.avg_charge != null) {
                    if (!allTargetProcedures.has(code)) {
                        allTargetProcedures.set(code, {
                            totalCharge: 0,
                            totalVolume: 0
                        });
                    }
                    const existing = allTargetProcedures.get(code);
                    existing.totalCharge += procData.avg_charge * procData.volume;
                    existing.totalVolume += procData.volume;
                }
            });
        }
    });

    console.log(`[National Market Position] Using ${allTargetProcedures.size} procedures from target hospital(s)`);

    // Calculate national average using volume-weighted methodology
    let nationalWeightedRevenue = 0;
    let nationalWeightedVolume = 0;
    let targetWeightedRevenue = 0;
    let targetWeightedVolume = 0;

    allTargetProcedures.forEach((targetData, code) => {
        // Use the pre-calculated national average (already accounts for outliers if enabled)
        const nationalAvg = AppState.nationalAverages[code];

        if (nationalAvg && nationalAvg.avgCharge > 0) {
            const targetAvgForProc = targetData.totalCharge / targetData.totalVolume;

            // Weight by target volume for this procedure
            nationalWeightedRevenue += nationalAvg.avgCharge * targetData.totalVolume;
            nationalWeightedVolume += targetData.totalVolume;
            targetWeightedRevenue += targetAvgForProc * targetData.totalVolume;
            targetWeightedVolume += targetData.totalVolume;
        }
    });

    if (nationalWeightedVolume === 0 || targetWeightedVolume === 0) {
        console.log('[National Market Position] Insufficient volume data');
        return 0;
    }

    const nationalAvgCharge = nationalWeightedRevenue / nationalWeightedVolume;
    const targetAvgCharge = targetWeightedRevenue / targetWeightedVolume;

    if (nationalAvgCharge === 0) {
        console.log('[National Market Position] National average charge is 0');
        return 0;
    }

    // Calculate variance: (target - national) / national * 100
    const variance = ((targetAvgCharge - nationalAvgCharge) / nationalAvgCharge) * 100;

    console.log(`[National Market Position] Target avg: $${targetAvgCharge.toFixed(2)}, National avg: $${nationalAvgCharge.toFixed(2)}, Variance: ${variance.toFixed(2)}%`);

    return variance;
}

/**
 * Display overall metrics
 */
function displayOverallMetrics(results) {
    const metricsContainer = document.getElementById('overall-metrics');
    metricsContainer.innerHTML = '';

    // Validate results.overall exists and has required properties
    if (!results.overall || results.overall.variance === undefined) {
        console.error('Missing results.overall data');
        return;
    }

    // Calculate market positions
    const peerGroupPosition = results.overall.variance; // % above/below selected peer group
    const stateMarketPosition = calculateStateMarketPosition(results);  // ALWAYS vs all state hospitals
    const nationalMarketPosition = calculateNationalMarketPosition(results);  // ALWAYS vs all national hospitals

    // Comprehensive logging for market positions
    console.log('=== MARKET POSITION SUMMARY ===');
    console.log('Peer Group Position:', peerGroupPosition.toFixed(2) + '% (compared to selected peer group)');
    console.log('State Market Position:', stateMarketPosition.toFixed(2) + '% (compared to ALL hospitals in target state(s))');
    console.log('National Market Position:', nationalMarketPosition.toFixed(2) + '% (compared to ALL hospitals nationally)');
    console.log('Target Hospitals:', results.targetHospitals.map(h => h.name).join(', '));
    console.log('Peer Hospitals:', results.compareHospitals.map(h => h.name).join(', '));
    console.log('===============================');

    const metrics = [
        {
            label: 'Procedures Compared',
            value: results.overall.procedureCount.toLocaleString(),
            subvalue: `${results.overall.targetVolume.toLocaleString()} total cases`,
            isPosition: false,
            tooltip: 'Number of procedures with matching data between target and peer hospitals'
        },
        {
            label: 'Peer Group Market Position',
            value: `${Math.abs(peerGroupPosition).toFixed(1)}%`,
            subvalue: peerGroupPosition < 0 ? 'Below peer average' : 'Above peer average',
            isPosition: true,
            positionValue: peerGroupPosition,
            showTriangle: true,
            tooltip: 'Target hospital pricing compared to selected peer hospitals. Changes when you modify peer selection or filters.'
        },
        {
            label: 'State Market Position',
            value: `${Math.abs(stateMarketPosition).toFixed(1)}%`,
            subvalue: stateMarketPosition < 0 ? 'Below state average' : 'Above state average',
            isPosition: true,
            positionValue: stateMarketPosition,
            showTriangle: true,
            tooltip: 'Target hospital pricing compared to ALL hospitals in the same state(s). Only changes when you change target hospital selection.'
        },
        {
            label: 'National Market Position',
            value: `${Math.abs(nationalMarketPosition).toFixed(1)}%`,
            subvalue: nationalMarketPosition < 0 ? 'Below national average' : 'Above national average',
            isPosition: true,
            positionValue: nationalMarketPosition,
            showTriangle: true,
            tooltip: 'Target hospital pricing compared to ALL hospitals nationally (41,000+ hospitals). Only changes when you change target hospital selection.'
        }
    ];

    metrics.forEach(metric => {
        const card = document.createElement('div');
        card.className = 'metric-card';

        // Add tooltip if available
        if (metric.tooltip) {
            card.title = metric.tooltip;
            card.style.cursor = 'help';
        }

        // Add color coding for market position cards
        if (metric.isPosition) {
            const colorClass = metric.positionValue < 0 ? 'position-favorable' : 'position-unfavorable';
            card.classList.add(colorClass);
        }

        // Add triangle indicator for position cards
        let valueContent = metric.value;
        if (metric.showTriangle) {
            const triangle = metric.positionValue < 0
                ? '<span class="triangle-down">▼</span>'
                : '<span class="triangle-up">▲</span>';
            valueContent = `${metric.value} ${triangle}`;
        }

        card.innerHTML = `
            <div class="metric-label">${metric.label}</div>
            <div class="metric-value">${valueContent}</div>
            <div class="metric-subvalue">${metric.subvalue}</div>
        `;

        metricsContainer.appendChild(card);
    });
}

/**
 * Display procedure comparison table
 */
function displayProcedureTable(results) {
    const tableBody = document.querySelector('#procedure-table tbody');
    tableBody.innerHTML = '';

    const fragment = document.createDocumentFragment();

    results.procedureComparisons.forEach(proc => {
        const row = document.createElement('tr');

        const varianceClass = proc.percentVariance > 0 ? 'variance-positive'
            : proc.percentVariance < 0 ? 'variance-negative'
                : 'variance-neutral';

        row.innerHTML = `
            <td class="code-cell">${proc.code}</td>
            <td>${proc.name}</td>
            <td class="number-cell">${proc.hospitalsCount}</td>
            <td class="number-cell">${proc.targetVolume.toLocaleString()}</td>
            <td class="number-cell">${proc.compareVolume.toLocaleString()}</td>
            <td class="number-cell">$${proc.targetAvgCharge.toFixed(2)}</td>
            <td class="number-cell">$${proc.compareAvgCharge.toFixed(2)}</td>
            <td class="number-cell">$${proc.targetRevenue.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
            <td class="number-cell">$${proc.compareRevenue.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
            <td class="number-cell">${proc.difference >= 0 ? '+' : ''}$${proc.difference.toFixed(2)}</td>
            <td class="number-cell"><span class="${varianceClass}">${proc.percentVariance >= 0 ? '+' : ''}${proc.percentVariance.toFixed(1)}%</span></td>
        `;

        // Store data for sorting
        row.dataset.code = proc.code;
        row.dataset.name = proc.name;
        row.dataset.targetAvgCharge = proc.targetAvgCharge;
        row.dataset.targetVolume = proc.targetVolume;
        row.dataset.targetRevenue = proc.targetRevenue;
        row.dataset.compareAvgCharge = proc.compareAvgCharge;
        row.dataset.compareVolume = proc.compareVolume;
        row.dataset.compareRevenue = proc.compareRevenue;
        row.dataset.hospitalsCount = proc.hospitalsCount;
        row.dataset.difference = proc.difference;
        row.dataset.percentVariance = proc.percentVariance;

        fragment.appendChild(row);
    });

    tableBody.appendChild(fragment);
}

/**
 * Display hospital comparison table - shows peer hospitals comparison
 */
function displayHospitalTable(results, sortColumn = 'percentVariance', sortDirection = 'desc') {
    const tableBody = document.querySelector('#hospital-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    // Calculate hospital-level comparisons
    const hospitalComparisons = [];

    // Get all procedure codes that exist in the comparison (1-to-1 matches only)
    const allProcedureCodes = new Set();
    results.procedureComparisons.forEach(proc => {
        allProcedureCodes.add(proc.code);
    });

    // If using national average, show TARGET hospitals compared to national avg
    // Otherwise show PEER hospitals
    const hospitalsToShow = results.useNationalAverage ? results.targetHospitals : results.compareHospitals;

    // Process each hospital
    hospitalsToShow.forEach(hospital => {
        // Calculate metrics for this hospital using CPT/HCPCS aggregation approach
        let hospitalTotalRevenue = 0;
        let compareTotalRevenue = 0;
        let hospitalTotalVolume = 0;
        let compareTotalVolume = 0;

        // For each procedure code in the comparison
        allProcedureCodes.forEach(code => {
            const hospitalProc = hospital.procedures[code];
            if (!hospitalProc || hospitalProc.volume === 0) return;

            if (results.useNationalAverage) {
                // Comparing target hospital to national average
                const nationalAvg = AppState.nationalAverages[code];
                if (!nationalAvg) return;

                hospitalTotalVolume += hospitalProc.volume;
                hospitalTotalRevenue += hospitalProc.avg_charge * hospitalProc.volume;
                compareTotalRevenue += nationalAvg.avgCharge * hospitalProc.volume;
                compareTotalVolume += hospitalProc.volume;
            } else {
                // Comparing peer hospital to target average
                // Calculate target average for this CPT code
                let targetAvgCharge = 0;
                let targetCount = 0;
                let targetVolumeForCode = 0;

                results.targetHospitals.forEach(targetHospital => {
                    const targetProc = targetHospital.procedures[code];
                    if (targetProc && targetProc.volume > 0) {
                        targetAvgCharge += targetProc.avg_charge;
                        targetVolumeForCode += targetProc.volume;
                        targetCount++;
                    }
                });

                if (targetCount === 0) return;

                // Average the target charges for this CPT code
                targetAvgCharge = targetAvgCharge / targetCount;

                // Use target volume for revenue calculation (apples-to-apples)
                hospitalTotalVolume += targetVolumeForCode;
                hospitalTotalRevenue += targetAvgCharge * targetVolumeForCode;
                compareTotalVolume += hospitalProc.volume;
                compareTotalRevenue += hospitalProc.avg_charge * targetVolumeForCode; // Use target volume!
            }
        });

        if (hospitalTotalVolume === 0) return;

        const hospitalAvgCharge = hospitalTotalRevenue / hospitalTotalVolume;
        const compareAvgCharge = compareTotalRevenue / hospitalTotalVolume;

        // Calculate variance
        const difference = hospitalTotalRevenue - compareTotalRevenue;
        const percentVariance = compareTotalRevenue > 0 ? ((difference / compareTotalRevenue) * 100) : 0;

        hospitalComparisons.push({
            provnum: hospital.provnum,
            hospitalName: hospital.name,
            targetVolume: hospitalTotalVolume,
            peerVolume: compareTotalVolume,
            targetAvgCharge: hospitalAvgCharge,
            peerAvgCharge: compareAvgCharge,
            targetRevenue: hospitalTotalRevenue,
            peerRevenue: compareTotalRevenue,
            percentVariance
        });
    });

    // Sort by specified column and direction
    hospitalComparisons.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        // Handle string sorting
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });

    // Render table rows
    const fragment = document.createDocumentFragment();

    hospitalComparisons.forEach(hosp => {
        const row = document.createElement('tr');

        const varianceClass = hosp.percentVariance > 0 ? 'variance-positive'
            : hosp.percentVariance < 0 ? 'variance-negative'
                : 'variance-neutral';

        row.innerHTML = `
            <td class="code-cell">${hosp.provnum}</td>
            <td>${hosp.hospitalName}</td>
            <td class="number-cell">${hosp.targetVolume.toLocaleString()}</td>
            <td class="number-cell">${hosp.peerVolume.toLocaleString()}</td>
            <td class="number-cell">$${hosp.targetAvgCharge.toFixed(2)}</td>
            <td class="number-cell">$${hosp.peerAvgCharge.toFixed(2)}</td>
            <td class="number-cell">$${hosp.targetRevenue.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
            <td class="number-cell">$${hosp.peerRevenue.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
            <td class="number-cell"><span class="${varianceClass}">${hosp.percentVariance >= 0 ? '+' : ''}${hosp.percentVariance.toFixed(1)}%</span></td>
        `;

        fragment.appendChild(row);
    });

    tableBody.appendChild(fragment);
}

/**
 * Display service category comparison table
 */
function displayCategoryTable(results, sortColumn = 'percentVariance', sortDirection = 'desc') {
    const tableBody = document.querySelector('#category-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    // Group procedures by service category (using same logic as CPT/HCPCS)
    const categoryData = {};

    results.procedureComparisons.forEach(proc => {
        const category = AppState.hospitalData.service_category_map[proc.code] || 'Uncategorized';

        if (!categoryData[category]) {
            categoryData[category] = {
                serviceCategory: category,
                servicesSet: new Set(),  // Track distinct CPT/HCPCS codes
                targetVolume: 0,
                peerVolume: 0,
                targetRevenue: 0,
                peerRevenue: 0
            };
        }

        categoryData[category].servicesSet.add(proc.code);  // Add CPT/HCPCS code to set
        categoryData[category].targetVolume += proc.targetVolume;
        categoryData[category].peerVolume += proc.compareVolume;
        // Use the same revenue calculation as CPT table (peer avg * target volume)
        categoryData[category].targetRevenue += proc.targetRevenue;
        categoryData[category].peerRevenue += proc.compareRevenue;
    });

    // Convert to array and calculate metrics (same as CPT/HCPCS logic)
    const categoryComparisons = Object.values(categoryData).map(cat => {
        const targetAvgCharge = cat.targetVolume > 0 ? cat.targetRevenue / cat.targetVolume : 0;
        const peerAvgCharge = cat.targetVolume > 0 ? cat.peerRevenue / cat.targetVolume : 0;
        const difference = cat.targetRevenue - cat.peerRevenue;
        const percentVariance = cat.peerRevenue > 0 ? ((difference / cat.peerRevenue) * 100) : 0;

        return {
            serviceCategory: cat.serviceCategory,
            servicesCount: cat.servicesSet.size,  // Count of distinct CPT/HCPCS codes
            targetVolume: cat.targetVolume,
            peerVolume: cat.peerVolume,
            targetAvgCharge,
            peerAvgCharge,
            targetRevenue: cat.targetRevenue,
            peerRevenue: cat.peerRevenue,
            percentVariance
        };
    });

    // Sort by specified column and direction
    categoryComparisons.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        // Handle string sorting
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });

    // Render table rows
    const fragment = document.createDocumentFragment();

    categoryComparisons.forEach(cat => {
        const row = document.createElement('tr');

        const varianceClass = cat.percentVariance > 0 ? 'variance-positive'
            : cat.percentVariance < 0 ? 'variance-negative'
                : 'variance-neutral';

        row.innerHTML = `
            <td>${cat.serviceCategory}</td>
            <td class="number-cell">${cat.servicesCount}</td>
            <td class="number-cell">${cat.targetVolume.toLocaleString()}</td>
            <td class="number-cell">${cat.peerVolume.toLocaleString()}</td>
            <td class="number-cell">$${cat.targetAvgCharge.toFixed(2)}</td>
            <td class="number-cell">$${cat.peerAvgCharge.toFixed(2)}</td>
            <td class="number-cell">$${cat.targetRevenue.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
            <td class="number-cell">$${cat.peerRevenue.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
            <td class="number-cell"><span class="${varianceClass}">${cat.percentVariance >= 0 ? '+' : ''}${cat.percentVariance.toFixed(1)}%</span></td>
        `;

        fragment.appendChild(row);
    });

    tableBody.appendChild(fragment);
}

/**
 * Display breakdown table with individual peer hospital charges
 */
function displayBreakdownTable(results, sortColumn = 'code', sortDirection = 'asc') {
    const tableHeaders = document.querySelector('#breakdown-headers');
    const tableBody = document.querySelector('#breakdown-table tbody');

    if (!tableHeaders || !tableBody) return;

    tableHeaders.innerHTML = '';
    tableBody.innerHTML = '';

    // Build dynamic headers - tableHeaders is already a <tr> element
    // Fixed columns
    const fixedHeaders = [
        { column: 'code', label: 'CPT/HCPCS' },
        { column: 'name', label: 'Procedure Name' },
        { column: 'hospitalsCount', label: '# Hospitals' },
        { column: 'targetVolume', label: 'Target Volume' },
        { column: 'targetRevenue', label: 'Target Revenue' },
        { column: 'targetAvgCharge', label: 'Target Avg Charge' },
        { column: 'compareAvgCharge', label: 'Peer Avg Charge' }
    ];

    fixedHeaders.forEach(header => {
        const th = document.createElement('th');
        th.className = 'sortable-header';
        th.dataset.column = header.column;
        th.innerHTML = `${header.label}<span class="sort-icon"></span>`;
        tableHeaders.appendChild(th);
    });

    // Get top 40 hospitals by net_patient_revenue
    // If using national average, use all available hospitals, otherwise use compareHospitals
    let hospitalsToShow;
    if (results.useNationalAverage) {
        // Get all hospitals and limit to top 40 by revenue
        hospitalsToShow = AppState.hospitalsArray
            .slice(0, 40); // Already sorted by net_patient_revenue in descending order
    } else {
        // Limit compareHospitals to top 40 by net_patient_revenue
        hospitalsToShow = results.compareHospitals
            .slice() // Create a copy to avoid modifying original
            .sort((a, b) => (b.net_patient_revenue || 0) - (a.net_patient_revenue || 0))
            .slice(0, 40);
    }

    // Dynamic peer hospital columns
    hospitalsToShow.forEach(hospital => {
        const th = document.createElement('th');
        th.className = 'sortable-header';
        th.dataset.column = `hospital_${hospital.provnum}`;
        th.innerHTML = `${hospital.name}<span class="sort-icon"></span>`;
        th.style.minWidth = '150px';
        tableHeaders.appendChild(th);
    });

    // Build table data
    const breakdownData = results.procedureComparisons.map(proc => {
        const row = {
            code: proc.code,
            name: proc.name,
            hospitalsCount: proc.hospitalsCount,
            targetVolume: proc.targetVolume,
            targetRevenue: proc.targetRevenue,
            targetAvgCharge: proc.targetAvgCharge,
            compareAvgCharge: proc.compareAvgCharge
        };

        // Add each peer hospital's charge for this procedure (top 40 only)
        hospitalsToShow.forEach(hospital => {
            const hospitalProc = hospital.procedures ? hospital.procedures[proc.code] : null;
            row[`hospital_${hospital.provnum}`] = (hospitalProc && hospitalProc.volume > 0 && hospitalProc.avg_charge != null)
                ? hospitalProc.avg_charge
                : null;
        });

        return row;
    });

    // Sort the data
    breakdownData.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        // Handle null values
        if (aVal === null) return 1;
        if (bVal === null) return -1;

        // Handle string sorting
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });

    // Render table rows
    const fragment = document.createDocumentFragment();

    breakdownData.forEach(item => {
        const row = document.createElement('tr');

        // Fixed columns
        row.innerHTML = `
            <td class="code-cell">${item.code}</td>
            <td>${item.name}</td>
            <td class="number-cell">${item.hospitalsCount}</td>
            <td class="number-cell">${item.targetVolume.toLocaleString()}</td>
            <td class="number-cell">$${item.targetRevenue.toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
            <td class="number-cell">$${item.targetAvgCharge.toFixed(2)}</td>
            <td class="number-cell">$${item.compareAvgCharge.toFixed(2)}</td>
        `;

        // Dynamic peer hospital columns
        hospitalsToShow.forEach(hospital => {
            const td = document.createElement('td');
            td.className = 'number-cell';
            const charge = item[`hospital_${hospital.provnum}`];
            td.textContent = (charge != null && charge !== undefined) ? `$${charge.toFixed(2)}` : '-';
            row.appendChild(td);
        });

        fragment.appendChild(row);
    });

    tableBody.appendChild(fragment);
}

/**
 * Setup table sorting
 */
function setupTableSorting() {
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.column;
            handleSort(column, header);
        });
    });
}

/**
 * Handle sort click
 */
function handleSort(column, headerElement) {
    // Determine which table this header belongs to
    const table = headerElement.closest('table');
    const tableId = table ? table.id : null;

    // Update sort state
    if (AppState.currentSort.column === column) {
        AppState.currentSort.direction = AppState.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        AppState.currentSort.column = column;
        AppState.currentSort.direction = 'asc';
    }

    // Update header classes only within this table
    table.querySelectorAll('.sortable-header').forEach(h => {
        h.classList.remove('active', 'asc', 'desc');
        h.querySelector('.sort-icon').textContent = '';
    });

    headerElement.classList.add('active', AppState.currentSort.direction);
    headerElement.querySelector('.sort-icon').textContent = AppState.currentSort.direction === 'asc' ? '▲' : '▼';

    // Re-sort and display the appropriate table
    if (AppState.currentResults) {
        if (tableId === 'procedure-table') {
            sortProcedureComparisons(AppState.currentResults.procedureComparisons);
            displayProcedureTable(AppState.currentResults);
        } else if (tableId === 'hospital-table') {
            displayHospitalTable(AppState.currentResults, column, AppState.currentSort.direction);
        } else if (tableId === 'category-table') {
            displayCategoryTable(AppState.currentResults, column, AppState.currentSort.direction);
        } else if (tableId === 'breakdown-table') {
            displayBreakdownTable(AppState.currentResults, column, AppState.currentSort.direction);
        }
    }
}

/**
 * Sort procedure comparisons
 */
function sortProcedureComparisons(comparisons) {
    const column = AppState.currentSort.column;
    const direction = AppState.currentSort.direction;

    comparisons.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];

        // Handle string sorting
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (direction === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
}

/**
 * Show loading state
 */
function showLoadingState() {
    DOM.emptyState.classList.add('hidden');
    DOM.resultsContent.classList.add('hidden');
    DOM.loadingState.classList.remove('hidden');
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    DOM.loadingState.classList.add('hidden');
    DOM.emptyState.classList.remove('hidden');
}

/**
 * Reset form to initial state
 */
function resetForm() {
    // Clear selections
    AppState.selectedTargetHospitals.clear();
    AppState.selectedCompareHospitals.clear();

    // Clear inputs
    DOM.targetSearchInput.value = '';
    DOM.compareSearchInput.value = '';

    // Clear selected displays
    DOM.targetSelected.innerHTML = '';
    DOM.compareSelected.innerHTML = '';

    // Hide dropdowns
    DOM.targetDropdown.classList.add('hidden');
    DOM.compareDropdown.classList.add('hidden');
    DOM.procedureDropdown.classList.add('hidden');

    // Clear hospital filters
    clearFilters('target');
    clearFilters('compare');

    // Clear procedure filters
    clearProcedureFilters();

    // Hide filter sections
    DOM.targetAdvancedFilters.classList.add('hidden');
    DOM.compareAdvancedFilters.classList.add('hidden');
    DOM.targetFilterToggle.classList.remove('active');
    DOM.compareFilterToggle.classList.remove('active');

    // Reset to empty state
    DOM.loadingState.classList.add('hidden');
    DOM.resultsContent.classList.add('hidden');
    DOM.emptyState.classList.remove('hidden');

    AppState.currentResults = null;
}

/**
 * Export results to CSV
 */
function exportToCSV() {
    if (!AppState.currentResults) {
        alert('No results to export');
        return;
    }

    const results = AppState.currentResults;
    const targetNames = results.targetHospitals.map(h => h.name).join('; ');
    const compareNames = results.useNationalAverage
        ? 'National Average'
        : results.compareHospitals.map(h => h.name).join('; ');

    let csv = 'Hospital Price Comparison Report\n\n';
    csv += `Target Hospital(s),"${targetNames}"\n`;
    csv += `Comparison,"${compareNames}"\n`;
    csv += `Overall Variance,${results.overall.variance.toFixed(1)}%\n\n`;

    csv += 'CPT/HCPCS Code,Procedure Name,Target Avg Charge,Target Volume,Target Revenue,Comparison Avg,Comparison Volume,Comparison Revenue,# Hospitals,Difference,% Variance\n';

    results.procedureComparisons.forEach(proc => {
        csv += `${proc.code},"${proc.name}",${proc.targetAvgCharge.toFixed(2)},${proc.targetVolume},${proc.targetRevenue.toFixed(2)},${proc.compareAvgCharge.toFixed(2)},${proc.compareVolume},${proc.compareRevenue.toFixed(2)},${proc.hospitalsCount},${proc.difference.toFixed(2)},${proc.percentVariance.toFixed(1)}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hospital-comparison-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

/**
 * Scroll to top of page with smooth animation
 */
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/**
 * Setup tab switching functionality
 */
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

/**
 * Switch to a specific tab
 */
function switchTab(tabName) {
    // Remove active class from all buttons and panels
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    // Add active class to selected button and panel
    const activeButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    const activePanel = document.getElementById(`tab-${tabName}`);

    if (activeButton && activePanel) {
        activeButton.classList.add('active');
        activePanel.classList.add('active');
    }
}

/**
 * Show message helper
 */
function showMessage(text, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${text}`);
}

/**
 * Hide message helper
 */
function hideMessage() {
    // Placeholder for future toast notifications
}

/* ============================================
   SAVE/LOAD FUNCTIONALITY
   ============================================ */

// LocalStorage keys
const STORAGE_KEYS = {
    SAVED_TARGETS: 'hospital_saved_targets',
    SAVED_PEERS: 'hospital_saved_peers'
};

// Current edit state
let currentEditItem = null;
let currentEditType = null;

/**
 * Initialize save/load functionality - SIMPLIFIED VERSION
 */
function initSaveLoadFeatures() {
    console.log('Initializing save/load features...');

    // Save buttons
    document.getElementById('save-target-btn').addEventListener('click', openSaveTargetModal);
    document.getElementById('save-peer-btn').addEventListener('click', openSavePeerModal);

    // View Saved buttons
    document.getElementById('view-saved-target-btn').addEventListener('click', openViewTargetModal);
    document.getElementById('view-saved-peer-btn').addEventListener('click', openViewPeerModal);

    // Save Target Modal
    document.getElementById('cancel-save-target').addEventListener('click', closeSaveTargetModal);
    document.getElementById('confirm-save-target').addEventListener('click', confirmSaveTarget);
    document.getElementById('save-target-modal').addEventListener('click', (e) => {
        if (e.target.id === 'save-target-modal') closeSaveTargetModal();
    });
    document.getElementById('save-target-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') confirmSaveTarget();
    });

    // Save Peer Modal
    document.getElementById('cancel-save-peer').addEventListener('click', closeSavePeerModal);
    document.getElementById('confirm-save-peer').addEventListener('click', confirmSavePeer);
    document.getElementById('save-peer-modal').addEventListener('click', (e) => {
        if (e.target.id === 'save-peer-modal') closeSavePeerModal();
    });
    document.getElementById('save-peer-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') confirmSavePeer();
    });

    // View Target Modal
    document.getElementById('close-view-target-modal').addEventListener('click', closeViewTargetModal);
    document.getElementById('view-saved-target-modal').addEventListener('click', (e) => {
        if (e.target.id === 'view-saved-target-modal') closeViewTargetModal();
    });

    // View Peer Modal
    document.getElementById('close-view-peer-modal').addEventListener('click', closeViewPeerModal);
    document.getElementById('view-saved-peer-modal').addEventListener('click', (e) => {
        if (e.target.id === 'view-saved-peer-modal') closeViewPeerModal();
    });

    // Edit Name Modal
    document.getElementById('close-edit-name-modal').addEventListener('click', closeEditNameModal);
    document.getElementById('cancel-edit-name').addEventListener('click', closeEditNameModal);
    document.getElementById('confirm-edit-name').addEventListener('click', confirmEditName);
    document.getElementById('edit-name-modal').addEventListener('click', (e) => {
        if (e.target.id === 'edit-name-modal') closeEditNameModal();
    });
    document.getElementById('edit-name-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') confirmEditName();
    });
}

/* ================ VIEW SAVED MODALS ================ */

function openViewTargetModal() {
    console.log('Opening View Target Modal');
    renderSavedTargetsInGrid();
    document.getElementById('view-saved-target-modal').classList.remove('hidden');
}

function closeViewTargetModal() {
    document.getElementById('view-saved-target-modal').classList.add('hidden');
}

function openViewPeerModal() {
    renderSavedPeersInGrid();
    document.getElementById('view-saved-peer-modal').classList.remove('hidden');
}

function closeViewPeerModal() {
    document.getElementById('view-saved-peer-modal').classList.add('hidden');
}

function renderSavedTargetsInGrid() {
    const saved = getSavedTargets();
    const container = document.getElementById('view-target-list');
    const emptyState = document.getElementById('view-target-empty');

    if (saved.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.innerHTML = saved.map(item => `
        <div class="saved-list-item" onclick="loadTargetFromGrid('${item.id}')">
            <div class="saved-list-main">
                <div class="saved-list-name">${escapeHtml(item.name)}</div>
                <div class="saved-list-details">
                    <span class="saved-list-count">${item.hospitals.length} hospital${item.hospitals.length !== 1 ? 's' : ''}</span>
                    <span class="saved-list-separator">•</span>
                    <span class="saved-list-date">${new Date(item.savedAt).toLocaleDateString()}</span>
                </div>
            </div>
            <div class="saved-list-actions">
                <button class="list-action-btn edit" onclick="event.stopPropagation(); editSavedItemFromGrid('${item.id}', 'target')" title="Rename">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                    </svg>
                </button>
                <button class="list-action-btn delete" onclick="event.stopPropagation(); deleteSavedItemFromGrid('${item.id}', 'target')" title="Delete">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function renderSavedPeersInGrid() {
    const saved = getSavedPeers();
    const container = document.getElementById('view-peer-list');
    const emptyState = document.getElementById('view-peer-empty');

    if (saved.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.innerHTML = saved.map(item => `
        <div class="saved-list-item" onclick="loadPeerFromGrid('${item.id}')">
            <div class="saved-list-main">
                <div class="saved-list-name">${escapeHtml(item.name)}</div>
                <div class="saved-list-details">
                    <span class="saved-list-count">${item.hospitals.length} hospital${item.hospitals.length !== 1 ? 's' : ''}</span>
                    <span class="saved-list-separator">•</span>
                    <span class="saved-list-date">${new Date(item.savedAt).toLocaleDateString()}</span>
                </div>
            </div>
            <div class="saved-list-actions">
                <button class="list-action-btn edit" onclick="event.stopPropagation(); editSavedItemFromGrid('${item.id}', 'peer')" title="Rename">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                    </svg>
                </button>
                <button class="list-action-btn delete" onclick="event.stopPropagation(); deleteSavedItemFromGrid('${item.id}', 'peer')" title="Delete">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// Global functions for grid onclick handlers
window.loadTargetFromGrid = function(id) {
    const saved = getSavedTargets();
    const item = saved.find(i => i.id === id);
    if (item) {
        loadTarget(item);
        closeViewTargetModal();
    }
};

window.loadPeerFromGrid = function(id) {
    const saved = getSavedPeers();
    const item = saved.find(i => i.id === id);
    if (item) {
        loadPeer(item);
        closeViewPeerModal();
    }
};

window.editSavedItemFromGrid = function(id, type) {
    const saved = type === 'target' ? getSavedTargets() : getSavedPeers();
    const item = saved.find(i => i.id === id);
    if (item) {
        openEditNameModal(item, type);
    }
};

window.deleteSavedItemFromGrid = function(id, type) {
    if (type === 'target') {
        deleteTarget(id);
        renderSavedTargetsInGrid();
    } else {
        deletePeer(id);
        renderSavedPeersInGrid();
    }
}

/* ================ SAVE TARGET ================ */

function openSaveTargetModal() {
    console.log('Opening Save Target Modal');
    // Check if there are selected hospitals or filters
    const hasSelection = AppState.selectedTargetHospitals.size > 0;
    const hasFilters = Object.values(AppState.filters.target).some(v => v !== '');

    if (!hasSelection && !hasFilters) {
        alert('Please select at least one hospital or apply filters before saving');
        return;
    }

    document.getElementById('save-target-name').value = '';
    document.getElementById('save-target-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('save-target-name').focus(), 100);
}

function closeSaveTargetModal() {
    document.getElementById('save-target-modal').classList.add('hidden');
}

function confirmSaveTarget() {
    const name = document.getElementById('save-target-name').value.trim();

    if (!name) {
        alert('Please enter a name for this target group');
        return;
    }

    const savedData = {
        id: Date.now().toString(),
        name: name,
        hospitals: Array.from(AppState.selectedTargetHospitals),
        filters: { ...AppState.filters.target },
        savedAt: new Date().toISOString()
    };

    // Get existing saved targets
    const saved = getSavedTargets();
    saved.push(savedData);
    localStorage.setItem(STORAGE_KEYS.SAVED_TARGETS, JSON.stringify(saved));

    closeSaveTargetModal();
    showSuccessMessage(`Saved "${name}" successfully!`);
}

function getSavedTargets() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_TARGETS) || '[]');
    } catch (e) {
        console.error('Error loading saved targets:', e);
        return [];
    }
}

// Old load modal functions removed - now using dropdown instead

function loadTarget(item) {
    // Clear current selection
    AppState.selectedTargetHospitals.clear();

    // Load saved hospitals
    item.hospitals.forEach(provnum => {
        AppState.selectedTargetHospitals.add(provnum);
    });

    // Load saved filters
    AppState.filters.target = { ...item.filters };

    // Update UI
    renderSelectedHospitals('target');
    updateFilterUI('target');

    showSuccessMessage(`Loaded "${item.name}"!`);
}

function deleteTarget(id) {
    if (!confirm('Are you sure you want to delete this saved target?')) return;

    const saved = getSavedTargets();
    const filtered = saved.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.SAVED_TARGETS, JSON.stringify(filtered));

    showSuccessMessage('Deleted successfully');
}

/* ================ SAVE PEER GROUP ================ */

function openSavePeerModal() {
    const hasSelection = AppState.selectedCompareHospitals.size > 0;
    const hasFilters = Object.values(AppState.filters.compare).some(v => v !== '');

    if (!hasSelection && !hasFilters) {
        alert('Please select at least one hospital or apply filters before saving');
        return;
    }

    document.getElementById('save-peer-name').value = '';
    document.getElementById('save-peer-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('save-peer-name').focus(), 100);
}

function closeSavePeerModal() {
    document.getElementById('save-peer-modal').classList.add('hidden');
}

function confirmSavePeer() {
    const name = document.getElementById('save-peer-name').value.trim();

    if (!name) {
        alert('Please enter a name for this peer group');
        return;
    }

    const savedData = {
        id: Date.now().toString(),
        name: name,
        hospitals: Array.from(AppState.selectedCompareHospitals),
        filters: { ...AppState.filters.compare },
        savedAt: new Date().toISOString()
    };

    const saved = getSavedPeers();
    saved.push(savedData);
    localStorage.setItem(STORAGE_KEYS.SAVED_PEERS, JSON.stringify(saved));

    closeSavePeerModal();
    showSuccessMessage(`Saved "${name}" successfully!`);
}

function getSavedPeers() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_PEERS) || '[]');
    } catch (e) {
        console.error('Error loading saved peers:', e);
        return [];
    }
}

// Old peer load modal functions removed - now using dropdown instead

function loadPeer(item) {
    AppState.selectedCompareHospitals.clear();

    item.hospitals.forEach(provnum => {
        AppState.selectedCompareHospitals.add(provnum);
    });

    AppState.filters.compare = { ...item.filters };

    renderSelectedHospitals('compare');
    updateFilterUI('compare');

    showSuccessMessage(`Loaded "${item.name}"!`);
}

function deletePeer(id) {
    if (!confirm('Are you sure you want to delete this saved peer group?')) return;

    const saved = getSavedPeers();
    const filtered = saved.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.SAVED_PEERS, JSON.stringify(filtered));

    showSuccessMessage('Deleted successfully');
}

/* ================ EDIT NAME ================ */

function openEditNameModal(item, type) {
    currentEditItem = item;
    currentEditType = type;

    document.getElementById('edit-name-input').value = item.name;
    document.getElementById('edit-name-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('edit-name-input').focus(), 100);
}

function closeEditNameModal() {
    document.getElementById('edit-name-modal').classList.add('hidden');
    currentEditItem = null;
    currentEditType = null;
}

function confirmEditName() {
    const newName = document.getElementById('edit-name-input').value.trim();

    if (!newName) {
        alert('Please enter a name');
        return;
    }

    if (currentEditType === 'target') {
        const saved = getSavedTargets();
        const item = saved.find(i => i.id === currentEditItem.id);
        if (item) {
            item.name = newName;
            localStorage.setItem(STORAGE_KEYS.SAVED_TARGETS, JSON.stringify(saved));
            renderSavedTargetsInGrid();
        }
    } else {
        const saved = getSavedPeers();
        const item = saved.find(i => i.id === currentEditItem.id);
        if (item) {
            item.name = newName;
            localStorage.setItem(STORAGE_KEYS.SAVED_PEERS, JSON.stringify(saved));
            renderSavedPeersInGrid();
        }
    }

    closeEditNameModal();
    showSuccessMessage('Renamed successfully');
}

/* ================ HELPERS ================ */

function updateFilterUI(type) {
    const filters = AppState.filters[type];
    const prefix = type === 'target' ? 'target' : 'compare';

    document.getElementById(`${prefix}-state`).value = filters.state || '';
    document.getElementById(`${prefix}-city`).value = filters.city || '';
    document.getElementById(`${prefix}-zip`).value = filters.zip || '';
    document.getElementById(`${prefix}-hospital-type`).value = filters.hospitalType || '';
    document.getElementById(`${prefix}-ownership`).value = filters.ownership || '';
    document.getElementById(`${prefix}-beds-min`).value = filters.bedsMin || '';
    document.getElementById(`${prefix}-beds-max`).value = filters.bedsMax || '';
}

function showSuccessMessage(message) {
    // Simple alert for now - can be enhanced with toast notifications
    console.log('✅', message);
    // Could add a toast notification here
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
