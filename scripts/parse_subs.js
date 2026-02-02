const fs = require('fs');
const path = require('path');

function parseSubs(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const subs = [];
    
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        
        // Skip alphabet headers like "A-Z"
        if (/^[A-Z]-[A-Z]$/.test(line) || line === "A-Z" || !line) {
            i++;
            continue;
        }
            
        // Check if line looks like it starts a subscription entry
        // A name usually followed by a @handle line
        if (i + 1 < lines.length && lines[i+1].trim().startsWith('@')) {
            const name = line;
            const handleLine = lines[i+1].trim();
            
            // Extract handle and sub count
            // Example: @onepercentclub12•130k subscribers
            const handleMatch = handleLine.match(/(@[^\u2022]+)\u2022(.+)/);
            let handle, sub_count_str;
            
            if (handleMatch) {
                handle = handleMatch[1].trim();
                sub_count_str = handleMatch[2].replace('subscribers', '').trim();
            } else {
                handle = handleLine;
                sub_count_str = "0";
            }

            // Description is usually the next line
            let description = "";
            if (i + 2 < lines.length) {
                const nextLine = lines[i+2].trim();
                if (nextLine && !nextLine.startsWith('@') && nextLine !== "Subscribed") {
                    description = nextLine;
                    i++; // Advance to consume description
                }
            }
            
            subs.append = subs.push({
                id: subs.length.toString(),
                name: name,
                handle: handle,
                sub_count: sub_count_str,
                description: description,
                status: "pending",
                tags: []
            });
            
            i++; // Advance past the handle line
        }
        
        i++;
    }
    
    return subs;
}

const inputFile = path.join('e:', 'Downloads', 'YT SUB', 'YT SUB.txt');
const outputFile = path.join('e:', 'Downloads', 'YT SUB', 'subs.json');

if (fs.existsSync(inputFile)) {
    const parsedData = parseSubs(inputFile);
    fs.writeFileSync(outputFile, JSON.stringify(parsedData, null, 2));
    console.log(`Successfully parsed ${parsedData.length} subscriptions.`);
} else {
    console.log(`File not found: ${inputFile}`);
}
