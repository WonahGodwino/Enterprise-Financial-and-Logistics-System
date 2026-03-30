# Issues Tracker

Use this file to resume large architecture updates.

## Open Architecture Follow-ups

1. Tenant Isolation: add Company scope to data model  
   https://github.com/WonahGodwino/Enterprise-Financial-and-Logistics-System/issues/5

2. Authorization Hardening: SUPER_ADMIN global, CEO company-only  
   https://github.com/WonahGodwino/Enterprise-Financial-and-Logistics-System/issues/6

## Notes
- Goal policy: only SUPER_ADMIN can access across companies.
- CEO should be restricted to own company and its subsidiaries.
- Current system is subsidiary-scoped, not company-tenant scoped yet.
