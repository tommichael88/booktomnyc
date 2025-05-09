                    document.addEventListener('DOMContentLoaded', function() {
                        // DOM element selections
                        const serviceOptions = document.querySelector('.service-category-grid');
                        const taskDetails = document.querySelector('.task-details');
                        const taskTextarea = taskDetails.querySelector('textarea');
                        const bookButton = document.querySelector('.book-button');
                        const selectedServicesSection = document.getElementById('selectedServicesSection');
                        const selectedSection = document.getElementById('selectedSection');
                        const furnitureOptionsSection = document.getElementById('furnitureOptionsSection');
                        const otherServiceSection = document.getElementById('otherServiceSection');
                        const otherServiceInput = document.getElementById('other-service-input');
                        const suggestionsDropdown = document.getElementById('suggestions-dropdown');
                        const categoryIcons = {
                            "Minor Home Repairs": "🏠",
                            "Furniture Fixes": "🛋️",
                            "Wall Mounting": "🧱",
                            "Electrical Help": "💡",
                            "Plumbing Help": "🚿",
                            "Computer Repairs": "💻"
                        };
                        const serviceIcons = {
                            "Drywall repair": "⬜",
                            "Door repair": "🚪",
                            "Window repair": "🪟",
                            "Tile repair": "𝄜",
                            "Assembly": "🪛",
                            "Repair": "🧰️",
                            "Moving": "🏃‍",
                            "Disassembly": "🪓",
                            "TV mounting": "📺",
                            "Shelf Install": "📚",
                            "Picture hanging": "🖼️",
                            "Mirror Install": "🪞",
                            "Light fixture Install": "💡",
                            "Outlet repair": "🔌",
                            "Switch replacement": "🔘",
                            "Ceiling fan Install": "🌀",
                            "Faucet repair": "🚰",
                            "Toilet repair": "🚽",
                            "Drain cleaning": "🪠",
                            "Pipe leak repair": "🚿",
                            "Virus removal": "🦠",
                            "Hardware upgrade": "💾",
                            "Software Install": "💿",
                            "Data recovery": "🖴"
                        };
                        // Global variables
                        let currentCategory = '';
                        let selectedServices = [];
                        let furnitureItems = {};
                        let hasCompletedSelection = false;
                        // Category services data
                        const categoryServices = {
                            "Minor Home Repairs": {
                                "Drywall repair": ["Small holes", "Large holes", "Cracks", "Texture matching"],
                                "Door repair": ["Hinges", "Locks", "Weather stripping", "Door frame"],
                                "Window repair": ["Glass replacement", "Weatherization", "Frame repair", "Sash replacement"],
                                "Tile repair": ["Grout repair", "Tile replacement", "Sealing", "Re-caulking"]
                            },
                            "Furniture Fixes": {
                                "Assembly": ["IKEA furniture", "Other brand furniture", "Outdoor furniture", "Office furniture"],
                                "Repair": ["Wood furniture", "Upholstery", "Metal furniture", "Antique restoration"],
                                "Moving": ["In-home rearrangement", "Loading/Unloading", "Furniture protection", "Disassembly/Reassembly"],
                                "Disassembly": ["IKEA furniture", "Other brand furniture", "For moving", "For disposal"]
                            },
                            "Wall Mounting": {
                                "TV mounting": ["Flat screen", "Curved screen", "Above fireplace", "With cable management"],
                                "Shelf Install": ["Floating shelves", "Bracket shelves", "Built-in shelves", "Heavy duty shelves"],
                                "Picture hanging": ["Single frame", "Gallery wall", "Heavy mirrors", "Artwork Install"],
                                "Mirror Install": ["Bathroom mirror", "Full-length mirror", "Decorative mirrors", "Custom shapes"]
                            },
                            "Electrical Help": {
                                "Light fixture Install": ["Ceiling lights", "Wall sconces", "Pendant lights", "Recessed lighting"],
                                "Outlet repair": ["GFCI Install", "USB outlet upgrade", "Loose outlet fix", "New outlet Install"],
                                "Switch replacement": ["Dimmer switch", "Smart switch", "Three-way switch", "Timer switch"],
                                "Ceiling fan Install": ["With light kit", "Remote control setup", "Balancing", "Existing wiring"]
                            },
                            "Plumbing Help": {
                                "Faucet repair": ["Leaky faucet", "Faucet replacement", "Cartridge replacement", "Low water pressure fix"],
                                "Toilet repair": ["Running toilet", "Clogged toilet", "Toilet replacement", "Bidet Install"],
                                "Drain cleaning": ["Sink drain", "Bathtub drain", "Shower drain", "Main line cleaning"],
                                "Pipe leak repair": ["Under sink", "In wall", "Copper pipe", "PVC pipe"]
                            },
                            "Computer Repairs": {
                                "Virus removal": ["Malware removal", "Spyware removal", "System cleanup", "Security software Install"],
                                "Hardware upgrade": ["RAM upgrade", "SSD Install", "Graphics card upgrade", "CPU replacement"],
                                "Software Install": ["Operating system", "Productivity software", "Antivirus software", "Driver updates"],
                                "Data recovery": ["Hard drive recovery", "SSD recovery", "File system repair", "Backup solution setup"]
                            }
                        };
                        const furnitureOptions = [{
                            category: "BEKANT",
                            items: ["Desk + underframe"]
                        }, {
                            category: "BESTA",
                            items: ["Single frame, shelves/floor standing", "Single frame, door/drawer, floor standing", "Single frame/wall mounting"]
                        }, {
                            category: "BILLY",
                            items: ["Bookcase 1x frame"]
                        }, {
                            category: "BJURSTA",
                            items: ["Extendable table"]
                        }, {
                            category: "BRIMNES",
                            items: ["Bed frame", "2 drawer chest", "3 drawer chest", "4 drawer chest", "Bed frame & storage", "Headboard", "Wardrobe 2x doors", "Wardrobe 3x doors", "Nightstand", "Daybed 2x drawers"]
                        }, {
                            category: "BRUSALI",
                            items: ["Bed frame", "Bed + 4 storage boxes", "3 drawer chest", "Nightstand"]
                        }, {
                            category: "FINGAL",
                            items: ["Swivel chair"]
                        }, {
                            category: "FRIHETEN",
                            items: ["Sofa bed & chaise"]
                        }, {
                            category: "GALANT",
                            items: ["2x drawer", "3x drawer", "4x drawer", "Cabinet (sliding doors)"]
                        }, {
                            category: "HEMNES",
                            items: ["Bed frame", "2 drawer chest", "3 drawer chest", "6 drawer chest", "Dresser 8x drawer", "Nightstand", "Daybed & 3 drawers"]
                        }, {
                            category: "KALLAX",
                            items: ["Shelving unit 5x5", "Shelving unit 4x4", "Shelving unit 2x4", "Shelving unit 1x4", "Shelving unit 2x2", "Insert + 2 drawers", "Insert + door"]
                        }, {
                            category: "LACK",
                            items: ["Side table", "Coffe table", "TV Unit"]
                        }, {
                            category: "LINNMON ADILS",
                            items: ["Table (table top and four legs)"]
                        }, {
                            category: "MALM",
                            items: ["Bed Frame", "Bed Frame + 4 Storage boxes", "2 Drawer Chest", "3 Drawer Chest", "4 Drawer Chest", "6 Drawer Chest", "6 Drawer Dresser", "Lift bed"]
                        }, {
                            category: "MICKE",
                            items: ["Desk + 1 Drawer", "Desk + Drawers & Storage", "Add-on unit"]
                        }, {
                            category: "MORVIK",
                            items: ["Wardrobe"]
                        }, {
                            category: "PAX",
                            items: ["One frame, hinged doors, up to 3 addons", "Two frames, sliding doors, up to 5 addons"]
                        }, {
                            category: "SODERHAMN",
                            items: ["Sofa one seat section + cover"]
                        }, {
                            category: "TRYSIL",
                            items: ["Bed Frame", "3 Drawer Chest", "Nightstand", "Wardrobe"]
                        }, {
                            category: "OTHER NOT LISTED",
                            items: ["NOT LISTED or UNKNOWN"]
                        }];
                        // Function to update selected services display
                        function updateSelectedServices() {
                            selectedServicesSection.innerHTML = '';
                            if (selectedServices.length > 0) {
                                const list = document.createElement('ul');
                                list.className = 'selected-services-list';
                                selectedServices.forEach(service => {
                                    const listItem = document.createElement('li');
                                    const serviceParts = service.split(' - ');
                                    const mainService = serviceParts.length > 1 ? serviceParts[1] : serviceParts[0];
                                    const serviceIcon = serviceIcons[mainService] || '🔧';
                                    // Service container
                                    const serviceContainer = document.createElement('div');
                                    serviceContainer.style.width = '100%';
                                    // Service content
                                    const serviceContent = document.createElement('div');
                                    serviceContent.style.display = 'flex';
                                    serviceContent.style.justifyContent = 'space-between';
                                    serviceContent.style.alignItems = 'center';
                                    serviceContent.innerHTML = `
                <span>${serviceIcon} ${service}</span>
                <button class="remove-service">❌</button>
            `;
                                    // Nested furniture list (only for Furniture Fixes)
                                    if (service.startsWith('Furniture Fixes') && furnitureItems[service]?.length > 0) {
                                        const furnitureList = document.createElement('ul');
                                        furnitureList.className = 'nested-furniture-list';
                                        furnitureItems[service].forEach(item => {
                                            const furnitureItem = document.createElement('li');
                                            furnitureItem.style.display = 'flex';
                                            furnitureItem.style.justifyContent = 'space-between';
                                            furnitureItem.style.alignItems = 'center';
                                            furnitureItem.innerHTML = `
                        <span>${item}</span>
                        <button class="remove-furniture">❌</button>
                    `;
                                            // Add remove functionality
                                            furnitureItem.querySelector('.remove-furniture').addEventListener('click', () => {
                                                furnitureItems[service] = furnitureItems[service].filter(i => i !== item);
                                                updateSelectedServices();
                                            });
                                            furnitureList.appendChild(furnitureItem);
                                        });
                                        serviceContainer.appendChild(furnitureList);
                                    }
                                    serviceContainer.appendChild(serviceContent);
                                    listItem.appendChild(serviceContainer);
                                    // Add service removal
                                    listItem.querySelector('.remove-service').addEventListener('click', () => {
                                        selectedServices = selectedServices.filter(s => s !== service);
                                        delete furnitureItems[service];
                                        updateSelectedServices();
                                    });
                                    list.appendChild(listItem);
                                });
                                selectedServicesSection.appendChild(list);
                                const clearAllButton = document.createElement('button');
                                clearAllButton.textContent = 'Clear All';
                                clearAllButton.className = 'clear-all-btn';
                                clearAllButton.addEventListener('click', clearAllServices);
                                selectedServicesSection.appendChild(clearAllButton);
                            }
                            if (hasCompletedSelection) {
                                taskDetails.style.display = 'block';
                                bookButton.style.display = 'block';
                            }
                            if (selectedServices.some(service => service.startsWith('Furniture Fixes'))) {
                                furnitureOptionsSection.style.display = 'block';
                                showFurnitureOptions();
                            } else {
                                furnitureOptionsSection.style.display = 'none';
                            }
                            selectedServicesSection.scrollIntoView({
                                behavior: 'smooth'
                            });
                        }
                        // Function to show category services
                        function showcategoryServices(category, subcategory = null) {
                            selectedSection.innerHTML = '';
                            currentCategory = category;
                            let currentLevel = categoryServices[category];
                            let title = category;
                            if (subcategory) {
                                currentLevel = currentLevel[subcategory];
                                title = subcategory;
                            }
                            const heading = document.createElement('h3');
                            heading.textContent = `${categoryIcons[category]} ${title}`;
                            selectedSection.appendChild(heading);
                            const optionsContainer = document.createElement('div');
                            optionsContainer.className = 'services';
                            if (Array.isArray(currentLevel)) {
                                currentLevel.forEach(function(option) {
                                    const button = document.createElement('button');
                                    const serviceIcon = serviceIcons[subcategory] || '🔧';
                                    button.innerHTML = `<span class="service-emoji">${serviceIcon}</span> ${option}`;
                                    button.addEventListener('click', function() {
                                        selectService(category, subcategory, option);
                                    });
                                    optionsContainer.appendChild(button);
                                });
                            } else {
                                Object.keys(currentLevel).forEach(function(option) {
                                    const button = document.createElement('button');
                                    const serviceIcon = serviceIcons[option] || '🔧';
                                    button.innerHTML = `<span class="service-emoji">${serviceIcon}</span> ${option}`;
                                    button.addEventListener('click', function() {
                                        if (subcategory) {
                                            selectService(category, subcategory, option);
                                        } else {
                                            showcategoryServices(category, option);
                                        }
                                    });
                                    optionsContainer.appendChild(button);
                                });
                            }
                            const otherButton = document.createElement('button');
                            otherButton.innerHTML = '<span class="service-emoji">❓</span> Other';
                            otherButton.addEventListener('click', function() {
                                showOtherServiceInput(category);
                            });
                            optionsContainer.appendChild(otherButton);
                            selectedSection.appendChild(optionsContainer);
                            const backButton = document.createElement('button');
                            backButton.id = 'backButton';
                            backButton.textContent = '↩ Back';
                            backButton.addEventListener('click', function() {
                                if (subcategory) {
                                    showcategoryServices(category);
                                } else {
                                    selectedSection.innerHTML = '';
                                    serviceOptions.style.display = 'grid';
                                }
                            });
                            selectedSection.appendChild(backButton);
                            serviceOptions.style.display = 'none';
                            selectedSection.style.display = 'block';
                            selectedSection.scrollIntoView({
                                behavior: 'smooth'
                            });
                        }

                        function showOtherServiceInput(category) {
                            currentCategory = category;
                            selectedSection.style.display = 'none';
                            otherServiceSection.style.display = 'block';
                            otherServiceInput.value = '';
                            otherServiceInput.focus();
                            suggestionsDropdown.innerHTML = '';
                            suggestionsDropdown.style.display = 'none';
                            const backButton = document.createElement('button');
                            backButton.textContent = '↩ Back';
                            backButton.addEventListener('click', function() {
                                otherServiceSection.style.display = 'none';
                                showcategoryServices(category);
                            });
                            const existingBackButton = otherServiceSection.querySelector('button');
                            if (!existingBackButton) {
                                otherServiceSection.insertBefore(backButton, otherServiceSection.firstChild);
                            }
                        }

                        function smartAutoComplete(input, category) {
                            const lowercaseInput = input.toLowerCase();
                            const suggestions = [];
                            const services = categoryServices[category];
                            for (const [service, subservices] of Object.entries(services)) {
                                if (service.toLowerCase().includes(lowercaseInput)) {
                                    suggestions.push({
                                        service: service,
                                        subservices: subservices
                                    });
                                }
                                for (const subservice of subservices) {
                                    if (subservice.toLowerCase().includes(lowercaseInput)) {
                                        suggestions.push({
                                            service: service,
                                            subservices: [subservice]
                                        });
                                    }
                                }
                            }
                            return suggestions;
                        }

                        function selectService(category, subcategory, option) {
                            let service = `${category} - ${subcategory}`;
                            if (option) {
                                service += ` - ${option}`;
                            }
                            if (!selectedServices.includes(service)) {
                                selectedServices.push(service);
                                furnitureItems[service] = []; // Initialize empty array for this service
                                hasCompletedSelection = true;
                                updateSelectedServices();
                            }
                            selectedSection.innerHTML = '';
                            serviceOptions.style.display = 'grid';
                            selectedServicesSection.scrollIntoView({
                                behavior: 'smooth'
                            });
                            selectedServicesSection.focus();
                            if (category === 'Furniture Fixes') {
                                showFurnitureOptions();
                            } else {
                                furnitureOptionsSection.style.display = 'none';
                            }
                        }

                        function removeService(service) {
                            selectedServices = selectedServices.filter(function(s) {
                                return s !== service;
                            });
                            updateSelectedServices();
                        }

                        function clearAllServices() {
                            selectedServices = [];
                            furnitureItems = {};
                            hasCompletedSelection = false;
                            updateSelectedServices();
                            selectedSection.innerHTML = '';
                            taskDetails.style.display = 'none';
                            bookButton.style.display = 'none';
                            serviceOptions.style.display = 'grid';
                            furnitureOptionsSection.style.display = 'none';
                        }

                        function showFurnitureOptions() {
                            furnitureOptionsSection.innerHTML = '';
                            furnitureOptionsSection.style.display = 'block';
                            const select = document.createElement('select');
                            select.id = 'furniture-select';
                            select.multiple = true;
                            const defaultOption = document.createElement('option');
                            defaultOption.textContent = 'Select furniture item(s)';
                            defaultOption.value = '';
                            defaultOption.disabled = true; // Make the default option disabled
                            defaultOption.selected = true; // Set it as the default selected option
                            select.appendChild(defaultOption);
                            furnitureOptions.forEach(option => {
                                const optgroup = document.createElement('optgroup');
                                optgroup.label = option.category;
                                option.items.forEach(item => {
                                    const optionElement = document.createElement('option');
                                    optionElement.textContent = item;
                                    optionElement.value = item;
                                    optgroup.appendChild(optionElement);
                                });
                                select.appendChild(optgroup);
                            });
                            const addButton = document.createElement('button');
                            addButton.textContent = '🗹Add Item';
                            addButton.disabled = true; // Initially disabled
                            addButton.addEventListener('click', addFurnitureItem);
                            const selectedList = document.createElement('ul');
                            selectedList.id = 'selectedFurnitureList';
                            const clearAllButton = document.createElement('button');
                            clearAllButton.textContent = '️Clear All';
                            clearAllButton.className = 'clear-all-items';
                            clearAllButton.disabled = true; // Initially disabled
                            clearAllButton.addEventListener('click', clearAllFurnitureItems);
                            // Event listener to enable/disable the add button based on selection
                            select.addEventListener('change', function() {
                                const selectedOptions = Array.from(this.selectedOptions).filter(option => option.value !== '');
                                addButton.disabled = selectedOptions.length === 0;
                                clearAllButton.disabled = selectedList.children.length === 0;
                            });
                            furnitureOptionsSection.appendChild(select);
                            furnitureOptionsSection.appendChild(addButton);
                            furnitureOptionsSection.appendChild(selectedList);
                            furnitureOptionsSection.appendChild(clearAllButton);
                        }

                        function addFurnitureItem() {
                            const select = document.getElementById('furniture-select');
                            const selectedItems = Array.from(select.selectedOptions)
                                .filter(option => option.value !== '')
                                .map(option => option.value);
                            if (selectedItems.length > 0) {
                                // Get the most recent service that is a furniture fix
                                const furnitureServices = selectedServices.filter(s => s.startsWith('Furniture Fixes'));
                                const lastFurnitureService = furnitureServices[furnitureServices.length - 1];
                                if (lastFurnitureService) {
                                    // Add items to our tracking object
                                    furnitureItems[lastFurnitureService] = furnitureItems[lastFurnitureService] || [];
                                    furnitureItems[lastFurnitureService].push(...selectedItems);
                                    updateSelectedServices(); // Re-render the entire list
                                }
                                select.value = '';
                            } else {
                                alert('Please select a furniture item.');
                            }
                        }

                        function clearAllFurnitureItems() {
                            const selectedList = document.getElementById('selectedFurnitureList');
                            selectedList.innerHTML = '';
                            clearAllButton.disabled = true; // Disable clear button after clearing list
                        }
                        // Event listeners
                        serviceOptions.addEventListener('click', function(event) {
                            if (event.target.classList.contains('service-category')) {
                                const category = event.target.textContent;
                                showcategoryServices(category);
                            }
                        });
                        // Updated input event listener
                        otherServiceInput.addEventListener('input', function() {
                            const input = this.value.trim().toLowerCase();
                            const suggestions = smartAutoComplete(input, currentCategory);
                            suggestionsDropdown.innerHTML = '';
                            if (suggestions.length > 0) {
                                suggestionsDropdown.style.display = 'block';
                                suggestions.forEach((suggestion) => {
                                    const div = document.createElement('div');
                                    div.classList.add('suggestion-item');
                                    div.innerHTML = `<strong>${suggestion.service}</strong>`;
                                    div.addEventListener('click', function() {
                                        selectService(currentCategory, suggestion.service, '');
                                        otherServiceSection.style.display = 'none';
                                        suggestionsDropdown.style.display = 'none';
                                    });
                                    suggestionsDropdown.appendChild(div);
                                });
                            } else {
                                suggestionsDropdown.style.display = 'none';
                            }
                        });
                        document.addEventListener('click', function(event) {
                            if (!otherServiceInput.contains(event.target) && !suggestionsDropdown.contains(event.target)) {
                                suggestionsDropdown.style.display = 'none';
                            }
                        });
                        if (bookButton) {
                            bookButton.addEventListener('click', function() {
                                if (selectedServices.length === 0) {
                                    alert('Please select at least one service before booking.');
                                } else {
                                    const additionalDetails = taskTextarea.value;
                                    alert(`Booking confirmed for: ${selectedServices.join(', ')}\n\nAdditional details: ${additionalDetails}`);
                                }
                            });
                        }
                        // Modal functionality
                        const modal = document.getElementById('mycontactModal');
                        const btn = document.getElementById('contactBtn');
                        const span = document.getElementsByClassName('contactModalClose')[0];
                        if (btn) {
                            btn.onclick = function() {
                                modal.style.display = 'block';
                            }
                        }
                        if (span) {
                            span.onclick = function() {
                                modal.style.display = 'none';
                            }
                        }
                        window.onclick = function(event) {
                            if (event.target == modal) {
                                modal.style.display = 'none';
                            }
                        }
                        // Contact buttons functionality
                        const emailButton = document.getElementById('emailButton');
                        if (emailButton) {
                            emailButton.addEventListener('click', function() {
                                window.location.href = 'mailto:booktom@icloud.com';
                            });
                        }
                        const callButton = document.getElementById('callButton');
                        if (callButton) {
                            callButton.addEventListener('click', function() {
                                window.location.href = 'tel:+19294501977';
                            });
                        }
                        const contactCardButton = document.getElementById('contactCardButton');
                        if (contactCardButton) {
                            contactCardButton.addEventListener('click', function() {
                                alert('Contact card functionality to be implemented');
                            });
                        }
                        const smsButton = document.getElementById('smsButton');
                        if (smsButton) {
                            smsButton.addEventListener('click', function() {
                                window.location.href = 'sms:+19294501977';
                            });
                        }
                        const manageVisitBtn = document.querySelector('.reschedule-service-button');
                        if (manageVisitBtn) {
                            manageVisitBtn.addEventListener('click', function() {
                                alert('Redirecting to Manage Your Visit page...');
                            });
                        }

                        function handleResize() {
                            if (window.innerWidth <= 800) {
                                serviceOptions.style.gridTemplateColumns = 'repeat(3, 1fr)';
                            } else {
                                serviceOptions.style.gridTemplateColumns = 'repeat(3, 1fr)';
                            }
                        }
                        window.addEventListener('resize', handleResize);
                        handleResize();
                    });
