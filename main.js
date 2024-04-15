        <script>
            document.addEventListener("DOMContentLoaded", function() {
                const serviceCheckboxes = document.querySelectorAll('.custom-checkbox input[type="checkbox"]');
                serviceCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        updateCheckedCategories(this); // Pass the checkbox element to the function
                    });
                });
                const selectedServicesContainer = document.getElementById("selectedServicesContainer");
                const suggestionsContainer = document.getElementById('suggestionsContainer');
                const taskDescription = document.getElementById('taskDescription');
                const submitButton = document.getElementById('submitButton');
                const chevron = document.getElementById('chevronArrow');
                const bookingDetails = document.getElementById('bookingDetails');
                let selectedServices = [];
                let checkedCategories = [];
                const categoryToServices = {
                    "service1": ["Appliances ⏰ Hourly", "Door Hardware", "Furniture Repair ⏰ Hourly", "Hollow Door Repair", "Wall Repair Patch & Paint"],
                    "service3": ["Frame/Shelf Mounting ⏰ Hourly", "TV (>60\") Mounting", "TV (>60\") Mounting + Hidden Cables", "Curtain Single Rod Install"],
                    "service6": ["Data Backup ", "Hardware Internal Part", "PC Diagnostic Service", "Software (4)", "System Restore", "Virus Removal"],
                    "service4": ["Light Fixture Swap"],
                    "service2": ["Furniture Assembly ⏰ Hourly", "Furniture Repair ⏰ Hourly"],
                    "service5": ["Bidet Add-on Install / Remove", "Fixture Swap (Cosmetic)", "Leak Under Sink Repair", "Unclog Sink Shower Toilet (Minor)"]
                };
                const targetedSuggestions = {
                    "Appliances ⏰ Hourly": ["Refrigerator Repair", "Washing Machine Repair", "Dryer Repair", "Dishwasher Repair", "Oven Repair", "Stove Repair", "Microwave Repair", "Garbage Disposal Repair", "Freezer Repair", "Ice Maker Repair", "Range Hood Repair", "Wine Cooler Repair", "Trash Compactor Repair"],
                    "Door Hardware": ["Electronic Lock Install", "Deadbolt Replacement", "Knob Handle Install", "Ring or Blink Doorbell Install", "Smart Lock Install", "Keyless Entry System Setup", "Rekeying Locks", "Door Handle Repair", "Security Door Install", "Key Duplication Service", "Peephole Install", "Door Reinforcement Install", "Lock Maintenance Service", "Emergency Lockout Assistance"],
                    "Wall Repair Patch & Paint": ["Small hole (e.g., nail or screw)", "Large hole (e.g., fist-sized)", "Crack Repair", "Textured Wall Patching", "Drywall Replacement"],
                    "TV (>60\") Mounting": ["TV Size Under 20 inches", "TV Size 32 inches", "TV Size 42 inches", "TV Size 50 inches", "TV Size 50+ inches", "Soundbar Install", "Cable Management Solutions", "Remote Control Setup"],
                    "Leak Under Sink Repair": ["Pipe Replacement", "Sealant Application", "Faucet Repair", "Sink Drain Replacement", "Sink Faucet Filter Install"],
                    "Virus Removal": ["Slow Performance Cleanup", "Pop-up Ad Removal", "Security Software Install", "Data Backup and Recovery", "Firewall Setup"],
                    "Frame/Shelf Mounting ⏰ Hourly": ["Picture Frame Mounting", "Floating Shelf Install", "Bookshelf Mounting", "Mirror Hanging", "Artwork Install"],
                    "Light Fixture Swap": ["Ceiling Light Fixture Replacement", "Wall Sconce Install", "Chandelier Install", "Recessed Lighting Install", "Track Lighting Install"],
                    "Bidet Add-on Install / Remove": ["Bidet Seat Install", "Bidet Add-on Install", "Bidet Seat Removal", "Water Pressure Adjustment", "Temperature Control Setup"],
                    "Fixture Swap (Cosmetic)": ["Faucet Replacement", "Light Switch Replacement", "Showerhead Replacement", "Toilet Seat Replacement", "Towel Rack Install"],
                    "Unclog Sink Shower Toilet (Minor)": ["Sink Unclogging", "Shower Drain Unclogging", "Toilet Unclogging", "Plunger and Auger Service", "Drain Cleaning Solution Application"],
                    "Data Backup ": ["Data Transfer to New Device", "Data Backup on External Drive", "Cloud Backup Setup", "Data Encryption Service", "Scheduled Backup Setup"],
                    "Hardware Internal Part Install": ["RAM Upgrade", "Hard Drive Replacement", "Graphics Card Install", "CPU Cooling System Install", "Motherboard Replacement"],
                    "PC Diagnostic Service": ["Performance Check", "Hardware Diagnostic", "Software Diagnostic", "Temperature Monitoring Service", "Internet Test"],
                    "Software (4)": ["Operating System Update", "Application Install", "Software Removal", "Driver Update", "Registry Cleanup"],
                    "System Restore": ["Operating System Rollback", "Data Recovery", "System Backup Restore", "Factory Reset Service", "Start Repair"],
                    "Furniture Assembly ⏰ Hourly": ["IKEA", "NOT IKEA", "Office Furniture Assembly", "Outdoor Furniture Assembly", "Custom Furniture Assembly"]
                };
                const dropdownOptionsForFurnitureAssembly = {
                    "Furniture Assembly ⏰ Hourly": ["Shoe rack", "Side table", "Lamp table", "Laundry hamper", "Footstool", "Dining table (extendable)", "Coffee table", "TV stand", "Console table", "Desk (small/medium)", "Desk (large)", "Bookcase (small/medium)", "Bookcase (large)", "Chest of drawers (small/medium)", "Chest of drawers (large 6+ Drawers)", "Wardrobe (small/medium)", "Wardrobe (large)", "Bed frame", "Sofa bed", "Kitchen cabinets", "OTHER/NOT LISTED"]
                };

                function updateSelectedServices(checkbox) {
                    const service = checkbox.dataset.service; // Use dataset attribute for flexibility
                    if (checkbox.checked) {
                        appendServiceToTextInput(service);
                    } else {
                        removeServiceFromTextInput(service);
                    }
                }

                function appendServiceToTextInput(service) {
                    if (!taskDescription.value.includes(service)) {
                        taskDescription.value += (taskDescription.value ? "; " : "") + service;
                        updateTextInputAppearance();
                        addServiceTag(service); // Add the tag for visual representation
                        selectedServices.push(service);
                    }
                }

                function removeServiceFromTextInput(service) {
                    // Update task description
                    const taskDescriptionParts = taskDescription.value.split('; ');
                    const index = taskDescriptionParts.indexOf(service);
                    if (index > -1) {
                        taskDescriptionParts.splice(index, 1);
                        taskDescription.value = taskDescriptionParts.join('; ');
                    }
                    // Update selectedServices array
                    selectedServices = selectedServices.filter(s => s !== service);
                    // Remove the service tag
                    removeServiceTag(service);
                    // Update UI elements
                    updateTextInputAppearance();
                    showSuggestions(); // Update suggestions if needed
                }

                function updateCheckedCategoriesAndTags(checkbox) {
                    const categoryId = checkbox.id; // Assuming the checkbox ID is the category key for the `categoryToServices`
                    const services = categoryToServices[categoryId] || [];
                    if (checkbox.checked) {
                        checkedCategories.push(categoryId); // Keep track of checked categories
                        // Add tags for each service in the category
                        serviceCheckboxes.forEach(checkbox => {
                            checkbox.addEventListener('change', function() {
                                // This function should now handle adding tags for specific services
                                updateCheckedCategoriesAndTags(this);
                            });
                        });
                    } else {
                        checkedCategories = checkedCategories.filter(id => id !== categoryId); // Remove the category
                        // Remove tags for each service in the category
                        services.forEach(service => {
                            removeServiceTag(service);
                            selectedServices = selectedServices.filter(s => s !== service);
                        });
                    }
                }

                function toggleBookingDetails(show) {
                    bookingDetails.style.display = show ? 'block' : 'none';
                    chevron.style.transform = show ? 'rotate(45deg)' : 'rotate(-70deg)';
                }

                function isAnyCategoryChecked() {
                    return checkedCategories.length > 0;
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

                function addServiceTag(service) {
                    const tag = document.createElement('div');
                    tag.className = 'service-tag';
                    tag.textContent = service;
                    const removeBtn = document.createElement('span');
                    removeBtn.textContent = '✖️️';
                    removeBtn.className = 'remove-service';
                    removeBtn.addEventListener('click', function() { // Attach event listener to the 'x' button
                        removeServiceFromTextInput(service);
                    });
                    tag.appendChild(removeBtn);
                    selectedServicesContainer.appendChild(tag);
                }

                function removeServiceTag(service) {
                    // Select the specific tag by its text content and remove it
                    const tags = selectedServicesContainer.querySelectorAll('.service-tag');
                    tags.forEach(tag => {
                        // Extract service name from the tag, excluding the 'X' button text
                        let serviceName = tag.firstChild.textContent.trim();
                        if (serviceName === service) {
                            selectedServicesContainer.removeChild(tag);
                        }
                    });
                    // Update the selectedServices array accordingly
                    const index = selectedServices.indexOf(service);
                    if (index > -1) {
                        selectedServices.splice(index, 1);
                    }
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
                            const serviceIndex = selectedServices.indexOf(service);
                            if (serviceIndex !== -1) {
                                selectedServices.splice(serviceIndex, 1);
                            }
                        });
                    }
                    updateTextInputAppearance();
                }

                function updateTextInput() {
                    taskDescription.value = selectedServices.join('; ');
                    updateTextInputAppearance();
                }

                function updateTextInputAppearance() {
                    taskDescription.style.borderColor = taskDescription.value.trim() !== '' ? 'red' : '';
                    submitButton.style.display = taskDescription.value.trim() !== '' ? 'block' : 'none';
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
                    dropdownLabel.textContent = 'Furniture:';
                    dropdownLabel.className = 'dropdown-label';
                    dropdownContainer.appendChild(dropdownLabel);
                    let dropdown = document.createElement('select');
                    dropdown.id = 'dynamicDropdown';
                    dropdown.className = 'dynamic-dropdown';
                    dropdownContainer.appendChild(dropdown);
                    let defaultOption = document.createElement('option');
                    defaultOption.textContent = "Assembly Item";
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
                const removeAllServicesButton = document.getElementById('removeAllServicesButton');
                removeAllServicesButton.addEventListener('click', () => {
                    taskDescription.value = '';
                    selectedFurnitureList.innerHTML = '';
                    checkedCategories = [];
                    serviceCheckboxes.forEach(checkbox => {
                        a
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
                3
            });
            btn.onclick = function(event) {
                event.preventDefault(); // Prevent default button behavior
                event.stopPropagation(); // Stop the event from bubbling up in the DOM
                contactModal.style.display = "block"; // Assumes 'contactModal' is defined
            };
        </script>
