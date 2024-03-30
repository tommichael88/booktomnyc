<script>
        document.addEventListener("DOMContentLoaded", function() {
            const serviceCheckboxes = document.querySelectorAll('.custom-checkbox input[type="checkbox"]');
            const suggestionsContainer = document.getElementById('suggestionsContainer');
            // Add event listeners to checkboxes
            serviceCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    updateCheckedCategories(this); // Pass the checkbox element to the function
                });
            });
            const taskDescription = document.getElementById('taskDescription');
            const submitButton = document.getElementById('submitButton');
            const chevron = document.getElementById('chevronArrow');
            const bookingDetails = document.getElementById('bookingDetails');
            let selectedServices = [];
            let checkedCategories = []; // Array to keep track of checked categories in order
            const categoryToServices = {
                "service1": ["Appliances Hourly Service Rate", "Door Handles & Locks Installation", "Furniture Repair Hourly Service Rate", "Hollow Door Repair", "Wall Repair - Patch & Paint"],
                "service3": ["Frame/Shelf Mounting Hourly Service Rate", "TV Mounting (Under 60\") + Concealed Cables", "TV Mounting (Under 60\") without cable management", "Curtains/Drapes w. Single Rod Installation"],
                "service6": ["Data Transfer / Data Back-Up", "Part Replacement/Upgrade", "PC Diagnostic Service", "Software Install/Update/Removal (4)", "System Restore", "Virus/Malware Removal"],
                "service4": ["Light Fixture Swap"],
                "service2": ["Furniture Assembly Hourly Service Rate", "Furniture Repair Hourly Service Rate"],
                "service5": ["Bidet Accessory Install/Removal", "Fixture Swap (Cosmetic)", "Leak Under Sink Repair", "Unclog Sink/Shower/Toilet (Minor)"]
            };
            const targetedSuggestions = {
                "Appliances Hourly Service Rate": ["Refrigerator Repair", "Washing Machine Repair", "Dryer Repair", "Dishwasher Repair", "Oven Repair", "Stove Repair", "Microwave Repair", "Garbage Disposal Repair", "Freezer Repair",
                    "Ice Maker Repair", "Range Hood Repair", "Wine Cooler Repair", "Trash Compactor Repair"
                ],
                "Door Handles & Locks Installation": ["Electronic Lock Installation", "Deadbolt Replacement", "Knob Handle Installation", "Ring or Blink Doorbell Install", "Smart Lock Installation", "Keyless Entry System Setup", "Rekeying Locks", "Door Handle Repair", "Security Door Installation", "Key Duplication Service", "Peephole Installation", "Door Reinforcement Installation", "Lock Maintenance Service", "Emergency Lockout Assistance"],
                "Wall Repair - Patch & Paint": ["Small hole (e.g., nail or screw)", "Large hole (e.g., fist-sized)", "Crack Repair", "Textured Wall Patching", "Drywall Replacement"],
                "TV Mounting (Under 60\") + Concealed Cables": ["TV Size Under 20 inches", "TV Size 32 inches", "TV Size 42 inches", "TV Size 50 inches", "TV Size 50+ inches", "Soundbar Installation", "Cable Management Solutions", "Remote Control Setup"],
                "Leak Under Sink Repair": ["Pipe Replacement", "Sealant Application", "Faucet Repair", "Sink Drain Replacement", "Under-Sink Filter Installation"],
                "Virus/Malware Removal": ["Slow Performance Cleanup", "Pop-up Ad Removal", "Security Software Installation", "Data Backup and Recovery", "Firewall Configuration"],
                "Frame/Shelf Mounting Hourly Service Rate": ["Picture Frame Mounting", "Floating Shelf Installation", "Bookshelf Mounting", "Mirror Hanging", "Artwork Installation"],
                "Light Fixture Swap": ["Ceiling Light Fixture Replacement", "Wall Sconce Installation", "Chandelier Installation", "Recessed Lighting Installation", "Track Lighting Installation"],
                "Bidet Accessory Install/Removal": ["Bidet Seat Installation", "Bidet Attachment Installation", "Bidet Seat Removal", "Water Pressure Adjustment", "Temperature Control Setup"],
                "Fixture Swap (Cosmetic)": ["Faucet Replacement", "Light Switch Replacement", "Showerhead Replacement", "Toilet Seat Replacement", "Towel Rack Installation"],
                "Unclog Sink/Shower/Toilet (Minor)": ["Sink Unclogging", "Shower Drain Unclogging", "Toilet Unclogging", "Plunger and Auger Service", "Drain Cleaning Solution Application"],
                "Data Transfer / Data Back-Up": ["Data Transfer to New Device", "Data Backup on External Drive", "Cloud Backup Setup", "Data Encryption Service", "Scheduled Backup Configuration"],
                "Part Replacement/Upgrade": ["RAM Upgrade", "Hard Drive Replacement", "Graphics Card Installation", "CPU Cooling System Installation", "Motherboard Replacement"],
                "PC Diagnostic Service": ["Performance Check", "Hardware Diagnostic", "Software Diagnostic", "Temperature Monitoring Service", "Network Connectivity Test"],
                "Software Install/Update/Removal (4)": ["Operating System Update", "Application Installation", "Software Uninstallation", "Driver Update Service", "Registry Cleanup"],
                "System Restore": ["Operating System Rollback", "Data Recovery", "System Backup Restoration", "Factory Reset Service", "Boot Repair"],
                "Furniture Assembly Hourly Service Rate": ["IKEA", "NOT IKEA", "Office Furniture Assembly", "Outdoor Furniture Assembly", "Custom Furniture Assembly"]
            };
            const dropdownOptionsForFurnitureAssembly = {
                "Furniture Assembly Hourly Service Rate": ["Shoe rack", "Side table", "Lamp table", "Laundry hamper", "Footstool", "Dining table (extendable)", "Coffee table", "TV stand", "Console table", "Desk (small/medium)", "Desk (large)", "Bookcase (small/medium)", "Bookcase (large)", "Chest of drawers (small/medium)", "Chest of drawers (large 6+ Drawers)", "Wardrobe (small/medium)", "Wardrobe (large)", "Bed frame", "Sofa bed", "Kitchen cabinets", "OTHER/NOT LISTED"]
            };

            function appendServiceToTextInput(service) {
                if (!taskDescription.value.includes(service)) {
                    taskDescription.value += (taskDescription.value ? "; " : "") + service;
                    updateTextInputAppearance();
                }
            }

            function toggleBookingDetails(show) {
                bookingDetails.style.display = show ? 'block' : 'none';
                chevron.style.transform = show ? 'rotate(90deg)' : 'rotate(-90deg)';
            }

            function isAnyCategoryChecked() {
                return checkedCategories.length > 0;
            }

            function updateTextInputAppearance() {
                taskDescription.style.borderColor = taskDescription.value.trim() !== '' ? 'red' : '';
                submitButton.style.display = taskDescription.value.trim() !== '' ? 'block' : 'none';
            }

            function updateTextInput() {
                taskDescription.value = selectedServices.join('; ');
                updateTextInputAppearance();
            }

            function showSuggestions(specificService = '') {
                suggestionsContainer.innerHTML = '';
                let servicesToShow = [];
                if (specificService && targetedSuggestions[specificService]) {
                    servicesToShow = targetedSuggestions[specificService];
                } else {
                    checkedCategories.slice().reverse().forEach(categoryId => {
                        if (categoryToServices[categoryId]) {
                            servicesToShow = servicesToShow.concat(categoryToServices[categoryId]);
                        }
                    });
                }
                servicesToShow.forEach(service => {
                    const button = createSuggestionButton(service, specificService);
                    suggestionsContainer.appendChild(button);
                });
                // Clear the text input box if no categories are checked
                if (!isAnyCategoryChecked() && specificService === '') {
                    taskDescription.value = '';
                }
                toggleBookingDetails(isAnyCategoryChecked() || specificService);
            }

            function createSuggestionButton(service, specificService) {
                const button = document.createElement('button');
                button.textContent = service;
                button.className = 'suggestion-btn';
                button.setAttribute('data-service', service);
                button.onclick = () => {
                    if (dropdownOptionsForFurnitureAssembly[service]) {
                        showDropdown(service);
                    } else {
                        appendServiceToTextInput(service);
                        if (!specificService || specificService && targetedSuggestions[service]) {
                            showSuggestions(service);
                        } else {
                            showSuggestions();
                        }
                    }
                };
                return button;
            }

            function updateCheckedCategories(checkbox) {
                const index = checkedCategories.indexOf(checkbox.id);
                if (checkbox.checked && index === -1) {
                    checkedCategories.push(checkbox.id);
                    const associatedServices = getAllAssociatedServices(checkbox.id);
                    selectedServices.push(...associatedServices);
                } else if (!checkbox.checked && index !== -1) {
                    checkedCategories.splice(index, 1);
                    const associatedServices = getAllAssociatedServices(checkbox.id);
                    associatedServices.forEach(service => {
                        removeServiceFromTextInput(service); // Remove associated services when category is unchecked
                        const serviceIndex = selectedServices.indexOf(service);
                        if (serviceIndex !== -1) {
                            selectedServices.splice(serviceIndex, 1);
                        }
                    });
                }
            }

            function showDropdown(service) {
                let existingDropdown = document.getElementById('dropdownContainer');
                if (existingDropdown) {
                    existingDropdown.remove();
                }
                let dropdownContainer = document.createElement('div');
                dropdownContainer.id = 'dropdownContainer';
                dropdownContainer.className = 'dropdown-container';
                let dropdownLabel = document.createElement('label');
                dropdownLabel.textContent = 'Select Furniture Type:';
                dropdownLabel.className = 'dropdown-label';
                dropdownContainer.appendChild(dropdownLabel);
                let dropdown = document.createElement('select');
                dropdown.id = 'dynamicDropdown';
                dropdown.className = 'dynamic-dropdown';
                dropdownContainer.appendChild(dropdown);
                let defaultOption = document.createElement('option');
                defaultOption.textContent = "Select an option";
                defaultOption.disabled = true;
                defaultOption.selected = true;
                dropdown.appendChild(defaultOption);
                let options = dropdownOptionsForFurnitureAssembly[service];
                options.forEach(option => {
                    let optionElement = document.createElement('option');
                    optionElement.textContent = option;
                    optionElement.value = option;
                    dropdown.appendChild(optionElement);
                });
                dropdown.addEventListener('change', function() {
                    if (this.value) {
                        taskDescription.value += (taskDescription.value ? "; " : "") + this.value;
                        dropdownContainer.remove();
                    }
                });
                taskDescription.before(dropdownContainer);
            }
            serviceCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    updateCheckedCategories(checkbox);
                    showSuggestions();
                    updateTextInputAppearance();
                });
            });
            const furnitureSelect = document.getElementById('furniture-select');
            const furnitureOptions = [{
                category: "BEKANT",
                items: ["Desk with underframe"]
            }, {
                category: "BESTA",
                items: ["Single frame, shelves, floor standing", "Single frame, door / drawer, floor standing", "Single frame, wall mounting"]
            }, {
                category: "BILLY",
                items: ["Bookcase one frame"]
            }, {
                category: "BJURSTA",
                items: ["Extendable table"]
            }, {
                category: "BRIMNES",
                items: ["Bed frame", "2 drawer chest", "3 drawer chest", "4 drawer chest", "Bed frame with storage", "Headboard", "Wardrobe with 2 doors", "Wardrobe with 3 doors", "Nightstand", "Daybed with 2 drawers"]
            }, {
                category: "BRUSALI",
                items: ["Bed frame", "Bed with 4 storage boxes", "3 drawer chest", "Nightstand"]
            }, {
                category: "FINGAL",
                items: ["Swivel chair"]
            }, {
                category: "FRIHETEN",
                items: ["Sofa bed with chaise"]
            }, {
                category: "GALANT",
                items: ["2 drawer unit", "3 drawer unit", "4 drawer unit", "Cabinet with sliding doors"]
            }, {
                category: "HEMNES",
                items: ["Bed frame", "2 drawer chest", "3 drawer chest", "6 drawer chest", "8 drawer dresser", "Nightstand", "Daybed with 3 drawers"]
            }, {
                category: "KALLAX",
                items: ["Shelving unit 5x5", "Shelving unit 4x4", "Shelving unit 2x4", "Shelving unit 1x4", "Shelving unit 2x2", "Insert with 2 drawers", "Insert with door"]
            }, {
                category: "LACK",
                items: ["Side table", "Coffe table", "TV Unit"]
            }, {
                category: "LINNMON ADILS",
                items: ["Table (table top and four legs)"]
            }, {
                category: "MALM",
                items: ["Bed Frame", "Bed Frame with 4 Storage boxes", "2 Drawer Chest", "3 Drawer Chest", "4 Drawer Chest", "6 Drawer Chest", "6 Drawer Dresser", "Lift bed"]
            }, {
                category: "MICKE",
                items: ["Desk with 1 Drawer", "Desk with Drawers & Storage", "Add-on unit"]
            }, {
                category: "MORVIK",
                items: ["Wardrobe"]
            }, {
                category: "PAX",
                items: ["One frame, hinged doors, up to 3 addons", "Two frames, sliding doors, up to 5 addons"]
            }, {
                category: "SODERHAMN",
                items: ["Sofa one seat section with cover"]
            }, {
                category: "TRYSIL",
                items: ["Bed Frame", "3 Drawer Chest", "Nightstand", "Wardrobe"]
            }, {
                category: "OTHER NOT LISTED",
                items: ["NOT LISTED or UNKNOWN"]
            }];

            function populateFurnitureSelect() {
                furnitureOptions.forEach(option => {
                    let optgroup = document.createElement('optgroup');
                    optgroup.label = option.category;
                    option.items.forEach(item => {
                        let optionElement = document.createElement('option');
                        optionElement.textContent = item;
                        optionElement.value = item;
                        optgroup.appendChild(optionElement);
                    });
                    furnitureSelect.appendChild(optgroup);
                });
            }
            populateFurnitureSelect();
            const addFurnitureButton = document.getElementById('addFurnitureButton');
            const selectedFurnitureList = document.getElementById('selectedFurnitureList');
            addFurnitureButton.addEventListener('click', () => {
                const selectedOption = furnitureSelect.options[furnitureSelect.selectedIndex];
                if (selectedOption) {
                    const selectedItem = selectedOption.textContent;
                    if (!selectedFurnitureList.textContent.includes(selectedItem)) {
                        const listItem = document.createElement('li');
                        listItem.textContent = selectedItem;
                        selectedFurnitureList.appendChild(listItem);
                        taskDescription.value += (taskDescription.value ? "; " : "") + selectedItem;
                        updateTextInputAppearance();
                    }
                }
            });
            const removeAllFurnitureButton = document.getElementById('removeAllFurnitureButton');
            removeAllFurnitureButton.addEventListener('click', () => {
                selectedFurnitureList.innerHTML = '';
                taskDescription.value = taskDescription.value.replace(/(Desk with underframe|Single frame, shelves, floor standing|Single frame, door \/ drawer, floor standing|Single frame, wall mounting|Bookcase one frame|Extendable table|Bed frame|2 drawer chest|3 drawer chest|4 drawer chest|Bed frame with storage|Headboard|Wardrobe with 2 doors|Wardrobe with 3 doors|Nightstand|Daybed with 2 drawers);?/g, '');
                updateTextInputAppearance();
            });
            const removeAllServicesButton = document.getElementById('removeAllServicesButton');
            removeAllServicesButton.addEventListener('click', () => {
                taskDescription.value = '';
                selectedFurnitureList.innerHTML = '';
                checkedCategories = [];
                serviceCheckboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
                updateTextInputAppearance();
                showSuggestions();
                toggleBookingDetails(false);
            });
            const chevronContainer = document.getElementById('chevronContainer');
            chevronContainer.addEventListener('click', () => {
                toggleBookingDetails(bookingDetails.style.display === 'none');
            });

            function copyTaskDescription() {
                const el = document.createElement('textarea');
                el.value = taskDescription.value;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
                alert('Copied to clipboard!');
            }
            const copyButton = document.getElementById('copyButton');
            copyButton.addEventListener('click', copyTaskDescription);
        });
    </script>
