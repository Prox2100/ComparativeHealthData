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

        // Convert to array and sort for better performance
        AppState.hospitalsArray = Object.values(AppState.hospitalData.hospitals)
            .map(h => ({
                ...h,
                searchText: `${h.name} ${h.provnum} ${h.city} ${h.state}`.toLowerCase()
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

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
            alert('An error occurred during comparison. Please try again.');
            hideLoadingState();
        }
    }, 100);
}

/**
 * Calculate price comparison
 */
function calculateComparison(targetProvnums, compareProvnums, procedureFilters, useNationalAverage, targetDescription, compareDescription) {
    const targetHospitals = targetProvnums.map(pn => AppState.hospitalData.hospitals[pn]);
    const compareHospitals = compareProvnums.map(pn => AppState.hospitalData.hospitals[pn]);

    // Get all procedures from target hospitals
    const allProcedureCodes = new Set();
    targetHospitals.forEach(hospital => {
        Object.keys(hospital.procedures).forEach(code => allProcedureCodes.add(code));
    });

    // Apply procedure filters if specified
    let proceduresToCompare = Array.from(allProcedureCodes);

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
            // Use selected hospitals
            compareAvgCharge = 0;
            compareTotalVol = 0;
            compareCount = 0;

            compareHospitals.forEach(hospital => {
                const proc = hospital.procedures[code];
                if (proc && proc.volume > 0) {
                    compareAvgCharge += proc.avg_charge;
                    compareTotalVol += proc.volume;
                    compareCount++;
                }
            });

            if (compareCount === 0) return;

            compareAvgCharge = compareAvgCharge / compareCount;
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

    const varianceElement = document.getElementById('overall-variance');
    const variance = results.overall.variance;
    varianceElement.textContent = `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%`;
    varianceElement.className = variance > 0 ? 'large-number variance-positive'
        : variance < 0 ? 'large-number variance-negative'
            : 'large-number variance-neutral';

    displayOverallMetrics(results);
    displayProcedureTable(results);
}

/**
 * Display overall metrics
 */
function displayOverallMetrics(results) {
    const metricsContainer = document.getElementById('overall-metrics');
    metricsContainer.innerHTML = '';

    const metrics = [
        {
            label: 'Procedures Compared',
            value: results.overall.procedureCount.toLocaleString(),
            subvalue: `${results.overall.targetVolume.toLocaleString()} total cases`
        },
        {
            label: 'Target Total Revenue',
            value: `$${results.overall.targetTotalRevenue.toLocaleString('en-US', {maximumFractionDigits: 0})}`,
            subvalue: 'Total charges'
        },
        {
            label: 'Comparison Total Revenue',
            value: `$${results.overall.compareTotalRevenue.toLocaleString('en-US', {maximumFractionDigits: 0})}`,
            subvalue: results.useNationalAverage ? 'National average' : 'Peer group total'
        },
        {
            label: 'Revenue Difference',
            value: `${results.overall.difference >= 0 ? '+' : ''}$${Math.abs(results.overall.difference).toLocaleString('en-US', {maximumFractionDigits: 0})}`,
            subvalue: `${results.overall.variance >= 0 ? '+' : ''}${results.overall.variance.toFixed(1)}% variance`
        }
    ];

    metrics.forEach(metric => {
        const card = document.createElement('div');
        card.className = 'metric-card';

        card.innerHTML = `
            <div class="metric-label">${metric.label}</div>
            <div class="metric-value">${metric.value}</div>
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
    // Update sort state
    if (AppState.currentSort.column === column) {
        AppState.currentSort.direction = AppState.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        AppState.currentSort.column = column;
        AppState.currentSort.direction = 'asc';
    }

    // Update header classes
    document.querySelectorAll('.sortable-header').forEach(h => {
        h.classList.remove('active', 'asc', 'desc');
        h.querySelector('.sort-icon').textContent = '';
    });

    headerElement.classList.add('active', AppState.currentSort.direction);
    headerElement.querySelector('.sort-icon').textContent = AppState.currentSort.direction === 'asc' ? '▲' : '▼';

    // Re-sort and display
    if (AppState.currentResults) {
        sortProcedureComparisons(AppState.currentResults.procedureComparisons);
        displayProcedureTable(AppState.currentResults);
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
