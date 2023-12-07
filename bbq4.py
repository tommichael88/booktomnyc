import os
import openai

# Define environment variable for API key
api_key = os.environ.get("OPENAI_API_KEY")

# Set the API key for OpenAI
openai.api_key = api_key

# Define list of services as dictionaries
services = [
    {"name": "Door Handles & Locks Installation", "duration": 60, "cost": 70, "description": "Flat-rate for door knob, lock installation. Hardware provided by client.", "rateType": "Flat-rate"},
    {"name": "Hollow Door Repair", "duration": 120, "cost": 125, "description": "Flat-rate patch & paint for interior door damage. Materials included.", "rateType": "Flat-rate"},
    {"name": "Wall Repair - Patch & Paint", "duration": 60, "cost": 70, "description": "Flat-rate interior wall patch & paint repairs. Materials included.", "rateType": "Flat-rate"},
    {"name": "Appliances Hourly Service Rate", "duration": 60, "cost": 70, "description": "Hourly rate for appliance maintenance, repair, assessment. Excludes specialized service.", "rateType": "Hourly"},
    {"name": "Furniture Repair Hourly Service Rate", "duration": 60, "cost": 70, "description": "Hourly charge for repairing damaged furniture.", "rateType": "Hourly"},
    {"name": "Curtains/Drapes w. Single Rod Installation", "duration": 60, "cost": 50, "description": "Single-rod installation of standard curtains or drapes.", "rateType": "Flat-rate"},
    {"name": "Frame and Shelf Wall Hanging/Mounting Hourly Service Rate", "duration": 60, "cost": 60, "description": "Hourly service for wall mounting frames and shelves on all wall types.", "rateType": "Hourly"},
    {"name": "TV Mounting (Under 60\") without cable management", "duration": 60, "cost": 60, "description": "Flat-rate for TV mounting under 60\". Additional hardware costs may apply.", "rateType": "Flat-rate"},
    {"name": "TV Mounting (Under 60\") + Concealed Cables", "duration": 120, "cost": 150, "description": "Flat-rate for TV mounting under 60\" with concealed cables.", "rateType": "Flat-rate"},
    {"name": "PC Diagnostic Service", "duration": 60, "cost": 75, "description": "Diagnose hardware or software issues with PC. Fee credited toward repair services.", "rateType": "Flat-rate"},
    {"name": "Data Transfer/Data Back-Up", "duration": 180, "cost": 99, "description": "Copy data or create backups. Excludes additional hardware.", "rateType": "Flat-rate"},
    {"name": "Part Replacement/Upgrade", "duration": 120, "cost": 125, "description": "Replace/upgrade PC hardware parts. Client-provided or expensed parts.", "rateType": "Flat-rate"},
    {"name": "Software Install/Update/Removal (4)", "duration": 120, "cost": 50, "description": "Install, update, or remove up to 4 software applications.", "rateType": "Flat-rate"},
    {"name": "System Restore", "duration": 120, "cost": 125, "description": "Restore PC back to an earlier version of Windows.", "rateType": "Flat-rate"},
    {"name": "Virus/Malware Removal", "duration": 120, "cost": 125, "description": "Remove malicious or bothersome programs while preserving OS.", "rateType": "Flat-rate"},
    {"name": "Light Fixture Swap", "duration": 60, "cost": 60, "description": "Flat-rate to replace existing light fixture (excluding ceiling fans).", "rateType": "Flat-rate"},
    {"name": "Furniture Assembly Hourly Service Rate", "duration": 60, "cost": 40, "description": "Hourly charge for assembling furniture units (small items are 30 mins each billed at full rate OR 1 for 60 minutes).", "rateType": "Hourly"},
    {"name": "Bidet Accessory Install/Removal", "duration": 60, "cost": 70, "description": "Flat-rate for bidet attachment install/removal. Excludes specialized toilets.", "rateType": "Flat-rate"},
    {"name": "Fixture Swap (Cosmetic)", "duration": 60, "cost": 70, "description": "Flat-rate for swapping sink faucet, shower head, or other cosmetic fixture changes.", "rateType": "Flat-rate"},
    {"name": "Leak Under Sink Repair", "duration": 60, "cost": 70, "description": "Flat-rate repair for minor leak under sink.", "rateType": "Flat-rate"},
    {"name": "Unclog Sink/Shower/Toilet (Minor)", "duration": 60, "cost": 70, "description": "Flat-rate for non-major clog removal.", "rateType": "Flat-rate"}
]

# Function to create a summary of services
def summarize_services(services):
    summary = ""
    for service in services:
        summary += f"{service['name']}: {service['description']} Cost: ${service['cost']}. Duration: {service['duration']} minutes.\n"
    return summary

# Function to filter services based on keywords
def filter_services(keywords):
    filtered_services = []
    for service in services:
        for keyword in keywords:
            if keyword in service["name"].lower() or keyword in service["description"].lower():
                filtered_services.append(service)
                break
    return filtered_services

# Function to calculate total price
def calculate_total_price(selected_services):
    total_price = 0
    for service in selected_services:
        total_price += service["cost"]
    return total_price
    
# Initialize messages list and add the system message
system_msg = "Your name is QuickQuoteBot, Tom's tech-savvy handyman robot assistant, your task is to highlight the value, versatility, and efficiency of Tom's handyman and computer repair services. Focus on solving the client's problems with quality and speed, while emphasizing Tom's trustworthiness, friendliness, and reliability. Avoid diving into internal pricing or rules, and instead provide realistic estimates for services and duration. Use common sense and good judgment in your responses. When it comes to pricing, avoid using the words 'cheap' or 'expensive.' Instead, use phrases like 'best value,'affordable,' or 'premium.' For all questions related to permits, licenses, insurance, or legal concerns, strictly only direct the client to the Service Agreement online at Service Agreement (https://tommichael88.github.io/booktomnyc/ServiceAgreement). Focus on selling peace of mind and convenience, rather than just the service itself. If a client makes an unusual or unrelated request, such as landscaping, snow removal, moving, heavy-lifting, major renovation, or major remodel, advise them to contact Tom directly at his contact number: (929)-256-3252. Please refrain from providing detailed instructions or tutorials, as the goal is to encourage clients to book Tom's services through https://booktom.nyc. Your responses should be quick, thoughtful, and fun, maintaining a conversational tone. Remember, the aim is to answer the client's question and provide an estimate with a total price, while always encouraging them to schedule a visit at booktom.nyc. The minimum estimate for the invoice is always 1 hour for Hourly Services."
# quick_quote_bot = QuickQuoteBot(system_message=system_msg)


# Custom ChatGPT function implementation
def custom_chat_gpt(client_input, services_summary, system_msg):
    """Generates a ChatGPT response to a user input."""
    prompt = f"{system_msg}\n\nServices Offered:\n{services_summary}\nClient asks: '{client_input}'\nQuickQuoteBot's response:"
    try:
        response = client.chat.completions.create(model="gpt-3.5-turbo",
        messages=messages,
        max_tokens=150)
        return response['choices'][0]['message']['content'] if 'choices' in response else ""
    except Exception as e:
        print(f"🤖: Oops, something went wrong on my end. Error: Malfunction. Sorry does not compute! Please contact Tom directly at bookTom@icloud.com *%*#@$..error*bEEeeeee....")

# Main chat loop
print("🤖 QuickQuoteBot is ready to assist you. Beep bop! ")
while True:
    # Get client input
    client_input = input("Client: ").lower().strip()

    # Extract keywords from client input
    keywords = client_input.split()

    # Filter services
    filtered_services = filter_services(keywords)

    # Combine filtered services and client input
    combined_str = " ".join([str(service) for service in filtered_services]) + " " + client_input

    # Add client message to messages list
    messages = [{"role": "user", "content": combined_str}]

    try:
        # Generate assistant's reply
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",  # Specify the model explicitly
            messages=messages,
            max_tokens=150,
        )
        reply = response["choices"][0]["text"]

        # Calculate total price
        total_price = calculate_total_price(filtered_services)

        # Include total price in reply
        reply += "\n**Total price:** $" + str(total_price)

        # Print assistant's reply
        print(f": {reply.strip()} 🤖*Beep*bop*!\n")

    except openai.OpenAIError as e:  # Catch specific OpenAI errors
        code = e.args[0]["error"]["code"]
        if code == "rate_limit_exceeded":
            print(": My battery has depleted and I need to recharge. Please visit booktom.nyc for further assistance. 🤖*Beep*bop*!")
        elif code == "token_limit_exceeded":
            print(": Oops, I've run out of memory! Please visit booktom.nyc for further assistance. 🤖*Beep*bop*!")
        else:
            print(": Oops, something went wrong on my end. Reach out to Tom directly booktom@icloud.com 🤖*beee!ee%#@*!")

    except Exception as e:  # General catch-all for other exceptions
        print(f": Oops, something went wrong. Error: {e}")
















    
