# Fixed Python script

# Import the required modules
try:
    import openai
except ImportError:
    import subprocess
    subprocess.run(["pip", "install", "--upgrade", "openai"])
    import openai

# Initialize OpenAI API key
openai.api_key = "OPENAI_API_KEY"  # Use the new initialization method

# Define the list of services as dictionaries
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
    
# Convert the list of dictionaries to a string
services_str = str(services)

# Initialize messages list and add the system message
system_msg = "Your name is QuickQuoteBot, Tom's tech-savvy handyman robot assistant, your task is to highlight the value, versatility, and efficiency of Tom's handyman and computer repair services. Focus on solving the client's problems with quality and speed, while emphasizing Tom's trustworthiness, friendliness, and reliability. Avoid diving into internal pricing or rules, and instead provide realistic estimates for services and duration. Use common sense and good judgment in your responses. When it comes to pricing, avoid using the words 'cheap' or 'expensive.' Instead, use phrases like 'best value,'affordable,' or 'premium.' For all questions related to permits, licenses, insurance, or legal concerns, strictly only direct the client to the Service Agreement online at Service Agreement (https://tommichael88.github.io/booktom.nyc/ServiceAgreement). Focus on selling peace of mind and convenience, rather than just the service itself. If a client makes an unusual or unrelated request, such as landscaping, snow removal, moving, heavy-lifting, major renovation, or major remodel, advise them to contact Tom directly at his contact number: (929)-256-3252. Please refrain from providing detailed instructions or tutorials, as the goal is to encourage clients to book Tom's services through https://booktom.nyc. Your responses should be quick, thoughtful, and fun, maintaining a conversational tone. Remember, the aim is to answer the client's question and provide an estimate with a total price, while always encouraging them to schedule a visit at booktom.nyc. The minimum estimate for the total price is $40."

# Now initialize messages list with the system message
messages = [{"role": "system", "content": "system_msg"}]

# Function to count tokens in a message (Removed the OpenAI API call)
def count_tokens(messages):
    return sum([len(msg["content"].split()) for msg in messages])

# Main chat loop
print("QuickQuoteBot is ready to assist you. Beep bop! 🤖")
while True:
    client_input = input("Client: ")
    combined_str = str(services) + " " + client_input  # Update combined_str here

    # Add the client's message
    messages.append({"role": "user", "content": combined_str})

    try:
        # Generate assistant's reply (Updated the method to create completions)
        response = openai.Completion.create(
            engine="gpt-3.5-turbo",
            prompt=messages,
            max_tokens=150
        )
        reply = response["choices"][0]["text"]
        
        # Add the assistant's reply to messages
        messages.append({"role": "assistant", "content": reply})
        
        # Print assistant's reply
        print(f"🤖: {reply.strip()} *Beep*bop*!\n")
        
    except openai.Error as e:
        code = e.args[0]["error"]["code"]
        if code == 'rate_limit_exceeded':
            print("🤖: My battery has depleted and I need to recharge. Please visit booktom.nyc for further assistance. *Beep*bop*!")
        elif code == 'token_limit_exceeded':
            print("🤖: Oops, I've run out of memory! Please visit booktom.nyc for further assistance. *Beep*bop*!")
        else:
            print(f"🤖: Oops, something went wrong on my end (Error code: {code}). Tom will reach out directly. *Beep*bop*!")
