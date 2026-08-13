import re

file_path = "local-backend/controllers/customerController.js"

with open(file_path, "r") as f:
    content = f.read()

# 1. Remove duplicate imports at the top
content = re.sub(
    r"const { v4: uuidv4 } = require\('uuid'\);\nconst Outbox = require\('@models/Outbox'\);\nconst fs = require\('fs'\);\nconst path = require\('path'\);\nconst ExcelJS = require\('exceljs'\);\n",
    "",
    content,
    count=1
)

# Fix duplicate functions by finding the second occurrence of their start
functions_to_dedup = [
    "// Create Customer\nconst createCustomer = async (req, res) => {",
    "// Get All Customers with Pagination\n\nconst getCustomers = async (req, res) => {",
    "// Get Single Customer\nconst getCustomerById = async (req, res) => {",
    "// Update Customer\nconst updateCustomer = async (req, res) => {",
    "// Delete Customer (Soft Delete)\nconst deleteCustomer = async (req, res) => {"
]

for func_start in functions_to_dedup:
    first_idx = content.find(func_start)
    if first_idx != -1:
        second_idx = content.find(func_start, first_idx + 1)
        if second_idx != -1:
            print(f"Removing duplicate for: {func_start[:30]}")
            content = content[:first_idx] + content[second_idx:]

with open(file_path, "w") as f:
    f.write(content)
print("Done")
