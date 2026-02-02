import json
import re
import os

def parse_subs(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    subs = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip alphabet headers like "A-Z"
        if re.match(r'^[A-Z]-[A-Z]$', line) or line == "A-Z":
            i += 1
            continue
            
        # Check if line looks like it starts a subscription entry
        # A name usually followed by a @handle line
        if i + 1 < len(lines) and lines[i+1].startswith('@'):
            name = line
            handle_line = lines[i+1].strip()
            
            # Extract handle and sub count
            # Example: @onepercentclub12•130k subscribers
            handle_match = re.match(r'(@[^\u2022]+)\u2022(.+)', handle_line)
            if handle_match:
                handle = handle_match.group(1).strip()
                sub_count_str = handle_match.group(2).replace('subscribers', '').strip()
            else:
                handle = handle_line
                sub_count_str = "0"

            # Description is usually the next line
            description = ""
            if i + 2 < len(lines):
                next_line = lines[i+2].strip()
                if next_line and not next_line.startswith('@') and next_line != "Subscribed":
                    description = next_line
                    i += 1 # Advance to consume description
            
            subs.append({
                "id": str(len(subs)),
                "name": name,
                "handle": handle,
                "sub_count": sub_count_str,
                "description": description,
                "status": "pending",
                "tags": []
            })
            
            i += 1 # Advance past the handle line
        
        i += 1
        
    return subs

if __name__ == "__main__":
    input_file = r'e:\Downloads\YT SUB\YT SUB.txt'
    output_file = r'e:\Downloads\YT SUB\subs.json'
    
    if os.path.exists(input_file):
        parsed_data = parse_subs(input_file)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(parsed_data, f, indent=2)
        print(f"Successfully parsed {len(parsed_data)} subscriptions.")
    else:
        print(f"File not found: {input_file}")
