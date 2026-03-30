-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CEO', 'MANAGER', 'ACCOUNTANT', 'VIEWER', 'EMPLOYEE', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('SIENNA', 'COROLLA', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE', 'SOLD');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('OPERATIONAL', 'ADMINISTRATIVE', 'MARKETING', 'CAPITAL', 'SECURITY_SERVICES', 'CONSTRUCTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'MAINTENANCE', 'REPAIRS', 'TYRES', 'INSURANCE', 'ROAD_TOLLS', 'PARKING', 'DRIVER_ALLOWANCE', 'VEHICLE_REGISTRATION', 'VEHICLE_INSPECTION', 'OIL_CHANGE', 'BRAKE_PADS', 'BATTERY', 'LIGHTS', 'WIPERS', 'CAR_WASH', 'DETAILING', 'SALARIES', 'WAGES', 'BONUSES', 'COMMISSIONS', 'STAFF_BENEFITS', 'PENSION', 'TRAINING', 'RECRUITMENT', 'RENT', 'UTILITIES', 'ELECTRICITY', 'WATER', 'INTERNET', 'TELEPHONE', 'OFFICE_SUPPLIES', 'STATIONERY', 'PRINTING', 'POSTAGE', 'COURIER', 'LEGAL_FEES', 'ACCOUNTING_FEES', 'CONSULTING_FEES', 'AUDIT_FEES', 'BANK_CHARGES', 'INTEREST', 'INSURANCE_ADMIN', 'SECURITY', 'CLEANING', 'WASTE_DISPOSAL', 'ADVERTISING', 'DIGITAL_MARKETING', 'SOCIAL_MEDIA_ADS', 'PRINT_ADS', 'BILLBOARDS', 'RADIO_ADS', 'TV_ADS', 'PROMOTIONS', 'DISCOUNTS', 'WEBSITE', 'SEO', 'CONTENT_CREATION', 'BRANDING', 'EVENT_SPONSORSHIP', 'TRADE_SHOWS', 'MARKETING_MATERIALS', 'BROCHURES', 'FLYERS', 'BUSINESS_CARDS', 'VEHICLE_PURCHASE', 'VEHICLE_IMPORT', 'VEHICLE_CUSTOMS', 'EQUIPMENT', 'MACHINERY', 'TOOLS', 'FURNITURE', 'OFFICE_EQUIPMENT', 'COMPUTER', 'LAPTOP', 'PRINTER', 'SCANNER', 'SOFTWARE', 'LICENSE', 'SUBSCRIPTION', 'RENOVATION', 'CONSTRUCTION', 'BUILDING', 'LAND', 'UNIFORMS', 'SECURITY_GEAR', 'GUARD_EQUIPMENT', 'CCTV_CAMERAS', 'CCTV_INSTALLATION', 'CCTV_MAINTENANCE', 'ALARM_SYSTEMS', 'ACCESS_CONTROL', 'SMART_HOME_DEVICES', 'SECURITY_CONSULTING', 'RISK_ASSESSMENT', 'SECURITY_AUDIT', 'GUARD_TRAINING', 'SECURITY_LICENSES', 'SECURITY_PERMITS', 'PATROL_VEHICLES', 'COMMUNICATION_EQUIPMENT', 'RADIOS', 'BODY_CAMERAS', 'CONSTRUCTION_MATERIALS', 'CEMENT', 'SAND', 'GRAVEL', 'GRANITE', 'BLOCKS', 'BRICKS', 'TIMBER', 'STEEL', 'REINFORCEMENT', 'NAILS', 'SCREWS', 'PAINT', 'TILES', 'ROOFING', 'PLUMBING_MATERIALS', 'ELECTRICAL_MATERIALS', 'WIRES', 'CONDUITS', 'FITTINGS', 'FIXTURES', 'DOORS', 'WINDOWS', 'HARDWARE', 'TOOLS_CONSTRUCTION', 'EQUIPMENT_RENTAL', 'CRANE', 'EXCAVATOR', 'CONCRETE_MIXER', 'GENERATOR', 'SUBCONTRACTORS', 'LABOR', 'SKILLED_LABOR', 'UNSKILLED_LABOR', 'PERMITS', 'BUILDING_PERMITS', 'ENVIRONMENTAL_PERMITS', 'SAFETY_GEAR', 'HELMETS', 'BOOTS', 'VESTS', 'GLOVES', 'SITE_SECURITY', 'SITE_CLEANUP', 'WASTE_REMOVAL', 'LOCAL_TRAVEL', 'INTERNATIONAL_TRAVEL', 'AIRFARE', 'HOTEL', 'MEALS', 'TRANSPORTATION', 'TAXI', 'RENTAL_CAR', 'FUEL_TRAVEL', 'PARKING_TRAVEL', 'TOLLS_TRAVEL', 'VISA', 'PASSPORT', 'DONATIONS', 'CHARITY', 'GIFTS', 'ENTERTAINMENT', 'CLIENT_ENTERTAINMENT', 'STAFF_ENTERTAINMENT', 'TEAM_BUILDING', 'STAFF_PARTY', 'SUBSISTENCE', 'PETTY_CASH', 'CONTINGENCY', 'MISCELLANEOUS', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'NEEDS_INFO', 'ESCALATED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD', 'DEBIT_CARD', 'POS', 'USSD', 'MOBILE_MONEY', 'CRYPTO', 'BANK_DRAFT', 'LETTER_OF_CREDIT', 'STANDING_ORDER', 'DIRECT_DEBIT', 'ONLINE_PAYMENT', 'PAYPAL', 'STRIPE', 'FLUTTERWAVE', 'PAYSTACK', 'INTERSWITCH', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurrencePattern" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('SUPPLIER', 'SERVICE_PROVIDER', 'CONTRACTOR', 'CONSULTANT', 'FREELANCER', 'GOVERNMENT', 'NON_PROFIT', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PREFERRED', 'BLACKLISTED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'PROJECT_BASED');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CLOSED', 'CANCELLED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL', 'URGENT');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED', 'PROSPECT', 'LEAD', 'CUSTOMER', 'VIP');

-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('SERVICE', 'PRODUCT', 'RENTAL', 'INSTALLATION', 'MAINTENANCE', 'CONSULTING', 'COMMISSION', 'ROYALTY', 'INTEREST', 'DIVIDEND', 'GRANT', 'DONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "IncomeCategory" AS ENUM ('CAR_HIRE', 'CAR_SALES', 'CAR_MAINTENANCE', 'CAR_RENTAL_DAILY', 'CAR_RENTAL_WEEKLY', 'CAR_RENTAL_MONTHLY', 'CAR_LEASE', 'CHAUFFEUR_SERVICE', 'AIRPORT_TRANSFER', 'EVENT_TRANSPORT', 'SECURITY_GUARD', 'CCTV_INSTALLATION', 'SMART_HOME', 'SECURITY_CONSULTING', 'ALARM_MONITORING', 'ACCESS_CONTROL', 'FIRE_ALARM', 'SECURITY_AUDIT', 'RISK_ASSESSMENT', 'EXECUTIVE_PROTECTION', 'EVENT_SECURITY', 'MOBILE_PATROL', 'GENERAL_CONTRACT', 'RENOVATION', 'CONSTRUCTION_MATERIALS', 'PROJECT_MANAGEMENT', 'ARCHITECTURAL_DESIGN', 'STRUCTURAL_ENGINEERING', 'BUILDING_CONSTRUCTION', 'ROAD_CONSTRUCTION', 'FOUNDATION_WORK', 'ROOFING', 'ELECTRICAL_INSTALLATION', 'PLUMBING_INSTALLATION', 'TILING', 'PAINTING', 'LANDSCAPING', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('STANDARD', 'PROFORMA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'RECEIPT', 'TAX_INVOICE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('INVOICE_PAYMENT', 'DEPOSIT', 'ADVANCE_PAYMENT', 'FINAL_PAYMENT', 'INSTALLMENT', 'REFUND', 'REIMBURSEMENT', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('CALCULATED', 'APPROVED', 'PROCESSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'PROCESSING', 'ANALYZED', 'REVIEWED', 'REJECTED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'PENDING_EMPLOYEE', 'PENDING_MANAGER', 'COMPLETED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "KpiCategory" AS ENUM ('REVENUE', 'OPERATIONAL', 'EFFICIENCY', 'QUALITY', 'ATTENDANCE', 'CUSTOMER_SATISFACTION', 'PROJECT_COMPLETION', 'TASK_COMPLETION', 'OTHER');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('FIXED', 'PERCENTAGE', 'RANGE', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "PerformanceRating" AS ENUM ('EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ColorCode" AS ENUM ('GREEN', 'YELLOW', 'ORANGE', 'RED');

-- CreateTable
CREATE TABLE "Subsidiary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subsidiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "initialOdometer" INTEGER,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyOperation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "operationDate" DATE NOT NULL,
    "openOdometer" INTEGER NOT NULL,
    "closeOdometer" INTEGER NOT NULL,
    "distanceCovered" INTEGER NOT NULL DEFAULT 0,
    "income" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clientName" TEXT,
    "jobDescription" TEXT,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "DailyOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "expenseType" "ExpenseType" NOT NULL,
    "expenseCategory" "ExpenseCategory" NOT NULL,
    "expenseSubCategory" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "exchangeRate" DOUBLE PRECISION DEFAULT 1,
    "description" TEXT,
    "details" TEXT,
    "reference" TEXT,
    "expenseDate" DATE NOT NULL,
    "recordedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE,
    "vehicleId" TEXT,
    "subsidiaryId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "vendorContact" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "jobId" TEXT,
    "jobName" TEXT,
    "approvalLevel" INTEGER NOT NULL DEFAULT 0,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvalHistory" JSONB,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "budgetId" TEXT,
    "budgetCode" TEXT,
    "budgetPeriod" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" "PaymentMethod",
    "paymentDate" TIMESTAMP(3),
    "paymentReference" TEXT,
    "bankAccount" TEXT,
    "chequeNumber" TEXT,
    "taxDeductible" BOOLEAN NOT NULL DEFAULT false,
    "taxCode" TEXT,
    "taxRate" DOUBLE PRECISION DEFAULT 0,
    "taxAmount" DOUBLE PRECISION DEFAULT 0,
    "taxRegion" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrencePattern" "RecurrencePattern",
    "recurrenceInterval" INTEGER,
    "recurrenceCount" INTEGER,
    "recurrenceEndDate" TIMESTAMP(3),
    "parentExpenseId" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "receiptNumber" TEXT,
    "attachments" JSONB,
    "supportingDocs" JSONB,
    "location" TEXT,
    "branch" TEXT,
    "department" TEXT,
    "costCenter" TEXT,
    "customFields" JSONB,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByIp" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendorType" "VendorType" NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "alternativePhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "taxId" TEXT,
    "registrationNumber" TEXT,
    "website" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "sortCode" TEXT,
    "swiftCode" TEXT,
    "paymentTerms" TEXT,
    "creditLimit" DOUBLE PRECISION DEFAULT 0,
    "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "rating" INTEGER DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "fiscalYear" INTEGER NOT NULL,
    "period" "BudgetPeriod" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "allocatedAmount" DOUBLE PRECISION NOT NULL,
    "spentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "committedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subsidiaryId" TEXT,
    "department" TEXT,
    "costCenter" TEXT,
    "projectId" TEXT,
    "expenseCategory" "ExpenseCategory",
    "expenseType" "ExpenseType",
    "status" "BudgetStatus" NOT NULL DEFAULT 'ACTIVE',
    "rollover" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAlert" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "currentAmount" DOUBLE PRECISION NOT NULL,
    "thresholdAmount" DOUBLE PRECISION NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "BudgetAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "subsidiaryAccess" TEXT[],
    "subsidiaryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT,
    "department" TEXT,
    "position" TEXT,
    "employmentDate" TIMESTAMP(3),
    "phoneNumber" TEXT,
    "emergencyContact" JSONB,
    "address" TEXT,
    "profileImage" TEXT,
    "performanceScore" DOUBLE PRECISION DEFAULT 0,
    "performanceRating" TEXT,
    "managerId" TEXT,
    "kpiDefinitions" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDescription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "reportsTo" TEXT,
    "jobSummary" TEXT NOT NULL,
    "responsibilities" JSONB NOT NULL,
    "qualifications" JSONB NOT NULL,
    "skills" JSONB NOT NULL,
    "experience" JSONB NOT NULL,
    "kpis" JSONB NOT NULL,
    "goals" JSONB NOT NULL,
    "objectives" JSONB NOT NULL,
    "performanceStandards" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reviewDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "weekEndDate" DATE NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "originalFile" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "processedFile" TEXT,
    "extractedData" JSONB,
    "kpiAnalysis" JSONB,
    "performanceScore" DOUBLE PRECISION DEFAULT 0,
    "performanceRating" TEXT,
    "colorCode" TEXT,
    "managerComments" TEXT,
    "managerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiAnalysis" JSONB,
    "correlationScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewType" "ReviewType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "averageScore" DOUBLE PRECISION NOT NULL,
    "overallRating" TEXT NOT NULL,
    "colorCode" TEXT,
    "kpiAchievements" JSONB NOT NULL,
    "taskCompletion" JSONB NOT NULL,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "managerComments" TEXT,
    "managerRating" INTEGER,
    "managerId" TEXT NOT NULL,
    "employeeComments" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "recommendations" JSONB,
    "nextReviewDate" TIMESTAMP(3),
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "KpiCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "defaultTarget" DOUBLE PRECISION,
    "minTarget" DOUBLE PRECISION,
    "maxTarget" DOUBLE PRECISION,
    "formula" TEXT,
    "dataSource" TEXT,
    "queryTemplate" TEXT,
    "aggregation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "companyName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "alternativePhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "taxId" TEXT,
    "registrationNumber" TEXT,
    "contactPerson" TEXT,
    "contactPosition" TEXT,
    "notes" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "creditLimit" DOUBLE PRECISION DEFAULT 0,
    "paymentTerms" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastTransactionAt" TIMESTAMP(3),
    "totalIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeRecord" (
    "id" TEXT NOT NULL,
    "incomeType" "IncomeType" NOT NULL,
    "category" "IncomeCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION DEFAULT 0,
    "discountAmount" DOUBLE PRECISION DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "exchangeRate" DOUBLE PRECISION DEFAULT 1,
    "incomeDate" DATE NOT NULL,
    "dueDate" DATE,
    "paidDate" DATE,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "subsidiaryId" TEXT,
    "invoiceId" TEXT,
    "serviceType" TEXT,
    "serviceDescription" TEXT,
    "quantity" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "paymentReference" TEXT,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "paidDate" DATE,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountType" "DiscountType",
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerId" TEXT NOT NULL,
    "subsidiaryId" TEXT NOT NULL,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "termsAndConditions" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION DEFAULT 0,
    "taxAmount" DOUBLE PRECISION DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "expenseId" TEXT,
    "operationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "exchangeRate" DOUBLE PRECISION DEFAULT 1,
    "paymentDate" DATE NOT NULL,
    "recordedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "incomeRecordId" TEXT,
    "expenseId" TEXT,
    "reference" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "chequeNumber" TEXT,
    "cardLastFour" TEXT,
    "transactionId" TEXT,
    "receiptNumber" TEXT,
    "receiptUrl" TEXT,
    "receivedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contributor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "investmentAmount" DOUBLE PRECISION NOT NULL,
    "investmentDate" DATE,
    "sharePercentage" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitDistribution" (
    "id" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalProfit" DOUBLE PRECISION NOT NULL,
    "retainedProfit" DOUBLE PRECISION NOT NULL,
    "distributableProfit" DOUBLE PRECISION NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'CALCULATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ProfitDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionDetail" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidDate" DATE,

    CONSTRAINT "DistributionDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subsidiary_name_key" ON "Subsidiary"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subsidiary_code_key" ON "Subsidiary"("code");

-- CreateIndex
CREATE INDEX "Subsidiary_code_idx" ON "Subsidiary"("code");

-- CreateIndex
CREATE INDEX "Subsidiary_isActive_idx" ON "Subsidiary"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE INDEX "Vehicle_subsidiaryId_idx" ON "Vehicle"("subsidiaryId");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE INDEX "DailyOperation_operationDate_idx" ON "DailyOperation"("operationDate");

-- CreateIndex
CREATE INDEX "DailyOperation_vehicleId_idx" ON "DailyOperation"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyOperation_vehicleId_operationDate_key" ON "DailyOperation"("vehicleId", "operationDate");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_expenseType_idx" ON "Expense"("expenseType");

-- CreateIndex
CREATE INDEX "Expense_expenseCategory_idx" ON "Expense"("expenseCategory");

-- CreateIndex
CREATE INDEX "Expense_paymentStatus_idx" ON "Expense"("paymentStatus");

-- CreateIndex
CREATE INDEX "Expense_approvalStatus_idx" ON "Expense"("approvalStatus");

-- CreateIndex
CREATE INDEX "Expense_vehicleId_idx" ON "Expense"("vehicleId");

-- CreateIndex
CREATE INDEX "Expense_subsidiaryId_idx" ON "Expense"("subsidiaryId");

-- CreateIndex
CREATE INDEX "Expense_vendorId_idx" ON "Expense"("vendorId");

-- CreateIndex
CREATE INDEX "Expense_projectId_idx" ON "Expense"("projectId");

-- CreateIndex
CREATE INDEX "Expense_budgetId_idx" ON "Expense"("budgetId");

-- CreateIndex
CREATE INDEX "Expense_isRecurring_idx" ON "Expense"("isRecurring");

-- CreateIndex
CREATE INDEX "Expense_createdById_idx" ON "Expense"("createdById");

-- CreateIndex
CREATE INDEX "Expense_approvedById_idx" ON "Expense"("approvedById");

-- CreateIndex
CREATE INDEX "Expense_subsidiaryId_expenseDate_idx" ON "Expense"("subsidiaryId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_vehicleId_expenseDate_idx" ON "Expense"("vehicleId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_vendorId_expenseDate_idx" ON "Expense"("vendorId", "expenseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_email_key" ON "Vendor"("email");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

-- CreateIndex
CREATE INDEX "Vendor_email_idx" ON "Vendor"("email");

-- CreateIndex
CREATE INDEX "Vendor_vendorType_idx" ON "Vendor"("vendorType");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_code_key" ON "Budget"("code");

-- CreateIndex
CREATE INDEX "Budget_fiscalYear_idx" ON "Budget"("fiscalYear");

-- CreateIndex
CREATE INDEX "Budget_subsidiaryId_idx" ON "Budget"("subsidiaryId");

-- CreateIndex
CREATE INDEX "Budget_status_idx" ON "Budget"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_code_fiscalYear_key" ON "Budget"("code", "fiscalYear");

-- CreateIndex
CREATE INDEX "BudgetAlert_budgetId_idx" ON "BudgetAlert"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetAlert_triggeredAt_idx" ON "BudgetAlert"("triggeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_employeeId_idx" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- CreateIndex
CREATE INDEX "User_department_idx" ON "User"("department");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_subsidiaryId_idx" ON "User"("subsidiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "JobDescription_userId_key" ON "JobDescription"("userId");

-- CreateIndex
CREATE INDEX "JobDescription_userId_idx" ON "JobDescription"("userId");

-- CreateIndex
CREATE INDEX "JobDescription_department_idx" ON "JobDescription"("department");

-- CreateIndex
CREATE INDEX "WeeklyReport_userId_weekNumber_year_idx" ON "WeeklyReport"("userId", "weekNumber", "year");

-- CreateIndex
CREATE INDEX "WeeklyReport_status_idx" ON "WeeklyReport"("status");

-- CreateIndex
CREATE INDEX "WeeklyReport_performanceRating_idx" ON "WeeklyReport"("performanceRating");

-- CreateIndex
CREATE INDEX "WeeklyReport_colorCode_idx" ON "WeeklyReport"("colorCode");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_userId_weekStartDate_weekEndDate_key" ON "WeeklyReport"("userId", "weekStartDate", "weekEndDate");

-- CreateIndex
CREATE INDEX "PerformanceReview_userId_reviewType_idx" ON "PerformanceReview"("userId", "reviewType");

-- CreateIndex
CREATE INDEX "PerformanceReview_periodStart_periodEnd_idx" ON "PerformanceReview"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PerformanceReview_overallRating_idx" ON "PerformanceReview"("overallRating");

-- CreateIndex
CREATE INDEX "KpiDefinition_category_idx" ON "KpiDefinition"("category");

-- CreateIndex
CREATE INDEX "KpiDefinition_isActive_idx" ON "KpiDefinition"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_customerType_idx" ON "Customer"("customerType");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeRecord_invoiceId_key" ON "IncomeRecord"("invoiceId");

-- CreateIndex
CREATE INDEX "IncomeRecord_incomeDate_idx" ON "IncomeRecord"("incomeDate");

-- CreateIndex
CREATE INDEX "IncomeRecord_customerId_idx" ON "IncomeRecord"("customerId");

-- CreateIndex
CREATE INDEX "IncomeRecord_vehicleId_idx" ON "IncomeRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "IncomeRecord_subsidiaryId_idx" ON "IncomeRecord"("subsidiaryId");

-- CreateIndex
CREATE INDEX "IncomeRecord_paymentStatus_idx" ON "IncomeRecord"("paymentStatus");

-- CreateIndex
CREATE INDEX "IncomeRecord_incomeType_idx" ON "IncomeRecord"("incomeType");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_paymentMethod_idx" ON "Payment"("paymentMethod");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitDistribution_periodStart_periodEnd_key" ON "ProfitDistribution"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionDetail_distributionId_contributorId_key" ON "DistributionDetail"("distributionId", "contributorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyOperation" ADD CONSTRAINT "DailyOperation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyOperation" ADD CONSTRAINT "DailyOperation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAlert" ADD CONSTRAINT "BudgetAlert_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiDefinition" ADD CONSTRAINT "KpiDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "Subsidiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_incomeRecordId_fkey" FOREIGN KEY ("incomeRecordId") REFERENCES "IncomeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionDetail" ADD CONSTRAINT "DistributionDetail_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "ProfitDistribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionDetail" ADD CONSTRAINT "DistributionDetail_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
