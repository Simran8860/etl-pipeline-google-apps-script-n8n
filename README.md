# Multi-Source ETL Pipeline using Google Apps Script & n8n

An end-to-end ETL (Extract, Transform, Load) pipeline that processes lead data from multiple sources, converts it into a canonical data model, validates records, detects duplicates, and generates structured output files.

The project demonstrates workflow automation using **n8n** and backend processing using **Google Apps Script**, following a modular architecture for maintainability and scalability.

---

## Features

* Read data from multiple sources
* Support both JSON and CSV input formats
* Transform data into a canonical schema
* Validate records
* Detect duplicate leads
* Generate structured output files
* API-based integration between n8n and Google Apps Script
* Modular and maintainable architecture
* Error workflow for handling failures

---

## Tech Stack

* Google Apps Script
* n8n
* JavaScript (ES6)
* JSON
* CSV
* REST API

---

## Architecture

```text
CRM (JSON)
              \
LinkedIn (CSV)
                \
Webinar (CSV) ---> n8n Workflow ---> Google Apps Script
                /                         |
Partner (JSON)                           |
                                         ▼
                                  Authentication
                                         ▼
                                      Parser
                                         ▼
                                   Transformer
                                         ▼
                                     Validator
                                         ▼
                               Duplicate Detector
                                         ▼
                                     Exporter
                                         ▼
                            Valid / Invalid / Duplicate
```

---

## Project Structure

```text
.
├── AppsScript
│   ├── appsscript.json
│   ├── config.gs
│   ├── parser.gs
│   ├── transformer.gs
│   ├── validator.gs
│   ├── duplicateDetector.gs
│   ├── exporter.gs
│   ├── logger.gs
│   └── main.gs
│
├── n8n
│   ├── workflow.json
│   └── error-workflow.json
│
├── Output
│   ├── valid-records.json
│   ├── invalid-records.json
│   └── duplicate-records.json
│
├── Screenshots
│   ├── 01-main-workflow.png
│   ├── 02-successful-execution.png
│   ├── 03-error-workflow.png
│   └── 04-output-files.png
│
└── README.md
```

---

## Input Sources

The pipeline accepts data from four independent sources.

| Source                | Format |
| --------------------- | ------ |
| CRM                   | JSON   |
| LinkedIn Leads        | CSV    |
| Webinar Registrations | CSV    |
| Partner Leads         | JSON   |

---

## Workflow

1. Read input files.
2. Parse JSON and CSV datasets.
3. Merge all sources into a single payload.
4. Send the payload to a Google Apps Script Web App.
5. Authenticate the request.
6. Transform records into a canonical model.
7. Validate records.
8. Detect duplicate leads.
9. Generate output files.
10. Return processed data.

---

## Canonical Data Model

```json
{
  "lead": {
    "name": "",
    "email": "",
    "phone": "",
    "job_title": "",
    "country": "",
    "city": ""
  },
  "company": {
    "name": "",
    "industry": "",
    "website": "",
    "size": ""
  },
  "metadata": {
    "source": "",
    "created_at": "",
    "processed_at": "",
    "tags": [],
    "consent": false
  }
}
```

---

## Validation

The validator checks:

* Required fields
* Email format
* Phone number format
* Missing values
* Basic data quality

Invalid records are separated before duplicate detection.

---

## Duplicate Detection

Duplicate detection follows two levels of matching.

### Primary Key

* Email Address

### Secondary Key

* Phone Number

If duplicate records are found, the following priority is applied.

1. CRM
2. LinkedIn
3. Webinar
4. Partner

Higher-priority records are retained while lower-priority records are marked as duplicates.

---

## Output Files

The pipeline generates:

* valid-records.json
* invalid-records.json
* duplicate-records.json

---

## Error Handling

The solution includes:

* Request validation
* Authentication
* Parsing error handling
* Validation error reporting
* Duplicate detection reporting
* Dedicated n8n error workflow

---

## Screenshots

### Main Workflow

<img width="1665" height="736" alt="Main n8n Workflow" src="https://github.com/user-attachments/assets/ae0c41a0-9905-4d00-8561-b6954a07222f" />


### Successful Execution

<img width="1802" height="763" alt="successful-execution" src="https://github.com/user-attachments/assets/803e617d-136b-4440-9419-5ca81f7a3b55" />


### Error Workflow

<img width="1579" height="805" alt="error-workflow" src="https://github.com/user-attachments/assets/ef7b6b92-1d47-46d9-9aef-c7baf0225d9b" />


### apps script Files

<img width="1920" height="828" alt="apps-script-project" src="https://github.com/user-attachments/assets/a5a363d8-5b6f-4ac6-9eb8-86a8e1b8024b" />




---

## Setup

### 1. Deploy Google Apps Script

Deploy the Apps Script project as a Web App.

Enable access for the required users.

---

### 2. Configure API Key

Create a Script Property.


---

### 3. Import n8n Workflow

Import:

* workflow.json
* error-workflow.json

---

### 4. Update HTTP Request Node

Replace the Web App URL with your deployed Apps Script endpoint.

---

### 5. Execute Workflow

Run the workflow using the Manual Trigger.

The processed output will be returned from the Google Apps Script Web App.

---

## Future Improvements

* Database integration
* Cloud Storage support
* Automated scheduling
* Retry mechanism
* Batch processing
* Monitoring and alerting
* Unit tests
* CI/CD pipeline

---

## Learning Outcomes

Through this project, I gained hands-on experience with:

* ETL pipeline design
* Workflow automation using n8n
* Google Apps Script Web Apps
* REST API integration
* Canonical data modeling
* Validation strategies
* Duplicate detection
* Modular JavaScript architecture

---

## License

This project is shared for educational and portfolio purposes.

---

## Author

**Simran Tyagi**

LinkedIn: https://www.linkedin.com/in/simran-tyagi/
