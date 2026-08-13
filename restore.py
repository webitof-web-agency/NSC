import json

log_path = "/home/rishabh/.gemini/antigravity-ide/brain/5eaf64ba-db59-4a83-9b20-f3ec41d5b3a1/.system_generated/logs/transcript.jsonl"
with open(log_path, "r") as f:
    lines = f.readlines()

for line in lines:
    data = json.loads(line)
    if data.get("type") == "TOOL_RESPONSE":
        content = data.get("content", "")
        # Find the very first time we read customerController.js which was 1237 lines long
        if "File Path: `file:///mnt/data/Github/office/Naresh/NSC-Electron/local-backend/controllers/customerController.js`" in content:
            if "Total Lines: 1237" in content or "Total Lines: 1470" in content:
                # We want the 1237 one
                pass

        if "Total Lines: 1237" in content and "customerController.js" in content:
            # We found the first view_file output.
            # However, view_file prepends line numbers! Let's extract the clean lines.
            lines_out = []
            for l in content.split("\n"):
                if ": " in l and l.split(":")[0].isdigit():
                    clean_line = l.split(": ", 1)[1]
                    lines_out.append(clean_line)
            
            with open("/mnt/data/Github/office/Naresh/NSC-Electron/local-backend/controllers/customerController.js", "w") as out:
                out.write("\n".join(lines_out) + "\n")
            
            print("Extracted part 1")
            break

