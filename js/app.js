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
    procedureTable: document.getElementById('procedure-table')
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

        console.log('App initialized successfully!');
        hideMessage();
    } catch (error) {
        console.error('Error initializing app:', error);
        showMessage('Failed to load hospital data. Please refresh the page.', 'error');
    }
}

/**
 * Load hospital data from JSON file
 */
async function loadHospitalData() {
    try {
        const response = await fetch('data/hospital_data.json');
        if (!response.ok) {
            throw new Error('Failed to fetch hospital data');
        }
        AppState.hospitalData = await response.json();

        // Convert to array and sort by net_patient_revenue (descending) for better performance
        AppState.hospitalsArray = Object.values(AppState.hospitalData.hospitals)
            .map(h => ({
                ...h,
                searchText: `${h.name} ${h.provnum} ${h.city} ${h.state}`.toLowerCase()
            }))
            .sort((a, b) => (b.net_patient_revenue || 0) - (a.net_patient_revenue || 0));

        console.log(`Loaded data for ${AppState.hospitalsArray.length} hospitals`);
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
        filterHospitals(e.target.value, 'target');
    }, 150));

    DOM.targetSearchInput.addEventListener('focus', () => {
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
            // Use selected hospitals - calculate weighted average
            let compareTotalCharges = 0;
            compareTotalVol = 0;
            compareCount = 0;

            compareHospitals.forEach(hospital => {
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
        }
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
 * Compares target hospitals against all hospitals in the same state(s)
 */
function calculateStateMarketPosition(results) {
    // Get all unique states from target hospitals
    const targetStates = new Set();
    results.targetHospitals.forEach(hospital => {
        if (hospital.state) {
            targetStates.add(hospital.state);
        }
    });

    if (targetStates.size === 0) return 0;

    // Filter all hospitals by target states
    const stateHospitals = AppState.hospitalsArray.filter(h =>
        targetStates.has(h.state) && h.procedures
    );

    if (stateHospitals.length === 0) return 0;

    // Calculate weighted average for state hospitals using same procedure codes
    let stateTotalRevenue = 0;
    let stateTotalVolume = 0;

    results.procedureComparisons.forEach(proc => {
        stateHospitals.forEach(hospital => {
            const hospitalProc = hospital.procedures[proc.code];
            if (hospitalProc && hospitalProc.volume > 0 && hospitalProc.avg_charge != null) {
                stateTotalRevenue += hospitalProc.avg_charge * hospitalProc.volume;
                stateTotalVolume += hospitalProc.volume;
            }
        });
    });

    if (stateTotalVolume === 0 || !results.overall.targetVolume || results.overall.targetVolume === 0) return 0;

    const stateAvgCharge = stateTotalRevenue / stateTotalVolume;
    const targetAvgCharge = results.overall.targetTotalRevenue / results.overall.targetVolume;

    if (stateAvgCharge === 0) return 0;

    // Calculate variance: (target - state) / state * 100
    return ((targetAvgCharge - stateAvgCharge) / stateAvgCharge) * 100;
}

/**
 * Calculate national market position
 * Compares target hospitals against all hospitals nationally
 */
function calculateNationalMarketPosition(results) {
    // Use all hospitals with procedures
    const nationalHospitals = AppState.hospitalsArray.filter(h => h.procedures);

    if (nationalHospitals.length === 0) return 0;

    // Calculate weighted average for national hospitals using same procedure codes
    let nationalTotalRevenue = 0;
    let nationalTotalVolume = 0;

    results.procedureComparisons.forEach(proc => {
        nationalHospitals.forEach(hospital => {
            const hospitalProc = hospital.procedures[proc.code];
            if (hospitalProc && hospitalProc.volume > 0 && hospitalProc.avg_charge != null) {
                nationalTotalRevenue += hospitalProc.avg_charge * hospitalProc.volume;
                nationalTotalVolume += hospitalProc.volume;
            }
        });
    });

    if (nationalTotalVolume === 0 || !results.overall.targetVolume || results.overall.targetVolume === 0) return 0;

    const nationalAvgCharge = nationalTotalRevenue / nationalTotalVolume;
    const targetAvgCharge = results.overall.targetTotalRevenue / results.overall.targetVolume;

    if (nationalAvgCharge === 0) return 0;

    // Calculate variance: (target - national) / national * 100
    return ((targetAvgCharge - nationalAvgCharge) / nationalAvgCharge) * 100;
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
    const peerGroupPosition = results.overall.variance; // Already calculated (% above/below peers)
    const stateMarketPosition = calculateStateMarketPosition(results);
    const nationalMarketPosition = calculateNationalMarketPosition(results);

    const metrics = [
        {
            label: 'Procedures Compared',
            value: results.overall.procedureCount.toLocaleString(),
            subvalue: `${results.overall.targetVolume.toLocaleString()} total cases`,
            isPosition: false
        },
        {
            label: 'Peer Group Market Position',
            value: `${Math.abs(peerGroupPosition).toFixed(1)}%`,
            subvalue: peerGroupPosition < 0 ? 'Below peer average' : 'Above peer average',
            isPosition: true,
            positionValue: peerGroupPosition,
            showTriangle: true
        },
        {
            label: 'State Market Position',
            value: `${Math.abs(stateMarketPosition).toFixed(1)}%`,
            subvalue: stateMarketPosition < 0 ? 'Below state average' : 'Above state average',
            isPosition: true,
            positionValue: stateMarketPosition,
            showTriangle: true
        },
        {
            label: 'National Market Position',
            value: `${Math.abs(nationalMarketPosition).toFixed(1)}%`,
            subvalue: nationalMarketPosition < 0 ? 'Below national average' : 'Above national average',
            isPosition: true,
            positionValue: nationalMarketPosition,
            showTriangle: true
        }
    ];

    metrics.forEach(metric => {
        const card = document.createElement('div');
        card.className = 'metric-card';

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

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
