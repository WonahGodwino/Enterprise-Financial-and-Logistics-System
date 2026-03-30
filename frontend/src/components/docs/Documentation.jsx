// frontend/src/components/docs/Documentation.jsx
import React, { useState } from 'react';
import {
  Book,
  FileText,
  Code,
  Shield,
  Users,
  Truck,
  DollarSign,
  Wrench,
  BarChart3,
  Search,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
  Copy,
  CheckCircle
} from 'lucide-react';

const Documentation = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState('getting-started');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const sections = [
    {
      id: 'getting-started',
      label: 'Getting Started',
      icon: Book,
      content: {
        title: 'Getting Started with MAPSI-EFMS',
        description: 'Learn the basics of using the Fleet Management System',
        sections: [
          {
            title: 'Introduction',
            content: 'MAPSI-EFMS (Enterprise Fleet Management System) is a comprehensive solution for managing your fleet operations, expenses, maintenance, and analytics. This documentation will guide you through all features and capabilities.'
          },
          {
            title: 'System Requirements',
            content: 'Modern web browser (Chrome, Firefox, Safari, Edge) • Internet connection • Company email for registration • Compatible with mobile devices'
          },
          {
            title: 'Quick Start Guide',
            content: '1. Login with your credentials\n2. Set up your company profile\n3. Add vehicles to your fleet\n4. Register drivers\n5. Start tracking operations'
          }
        ]
      }
    },
    {
      id: 'user-guide',
      label: 'User Guide',
      icon: Users,
      content: {
        title: 'User Guide',
        description: 'Detailed instructions for using system features',
        sections: [
          {
            title: 'Dashboard Overview',
            content: 'The dashboard provides a real-time overview of your fleet operations, including vehicle status, active trips, maintenance alerts, and key performance indicators.'
          },
          {
            title: 'Managing Vehicles',
            content: 'Add, edit, and track vehicles in your fleet. Monitor vehicle status, maintenance schedules, fuel consumption, and utilization metrics.'
          },
          {
            title: 'Tracking Expenses',
            content: 'Record and categorize expenses including fuel, maintenance, tolls, and driver expenses. Attach receipts and track approvals.'
          },
          {
            title: 'Reporting',
            content: 'Generate comprehensive reports including expense reports, fuel consumption analysis, driver performance, and financial summaries.'
          }
        ]
      }
    },
    {
      id: 'vehicle-management',
      label: 'Vehicle Management',
      icon: Truck,
      content: {
        title: 'Vehicle Management',
        description: 'Complete guide to managing your fleet vehicles',
        sections: [
          {
            title: 'Adding Vehicles',
            content: 'Navigate to Vehicles > Add New Vehicle. Fill in vehicle details including make, model, year, license plate, VIN, and assign to subsidiary.'
          },
          {
            title: 'Vehicle Status Tracking',
            content: 'Track vehicle status: Active, In Maintenance, Out of Service, or Retired. Set up automated status changes based on mileage or time.'
          },
          {
            title: 'Maintenance Scheduling',
            content: 'Schedule preventive maintenance based on mileage or time intervals. Get alerts when maintenance is due.'
          },
          {
            title: 'Fuel Tracking',
            content: 'Log fuel purchases, track fuel efficiency, monitor consumption patterns, and identify outliers.'
          }
        ]
      }
    },
    {
      id: 'expense-tracking',
      label: 'Expense Tracking',
      icon: DollarSign,
      content: {
        title: 'Expense Tracking',
        description: 'How to manage and track all fleet expenses',
        sections: [
          {
            title: 'Expense Categories',
            content: 'Expenses are categorized into: Fuel, Maintenance, Repairs, Insurance, Tolls, Parking, Driver Expenses, and Miscellaneous.'
          },
          {
            title: 'Adding Expenses',
            content: 'Click on Expenses > Add New. Select category, enter amount, attach receipt, assign to vehicle/driver, and submit for approval.'
          },
          {
            title: 'Approval Workflow',
            content: 'Expenses go through approval workflow: Submitted > Pending Approval > Approved/Rejected. Managers and admins can approve expenses.'
          },
          {
            title: 'Receipt Management',
            content: 'Upload receipts as images or PDFs. System extracts data using OCR for automatic entry.'
          }
        ]
      }
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: Wrench,
      content: {
        title: 'Maintenance Management',
        description: 'Keep your fleet in optimal condition',
        sections: [
          {
            title: 'Maintenance Types',
            content: 'Regular maintenance • Repairs • Inspections • Tire rotations • Oil changes • Brake service • Emergency repairs'
          },
          {
            title: 'Scheduling Maintenance',
            content: 'Set up maintenance schedules based on mileage intervals or time-based schedules. System will notify when maintenance is due.'
          },
          {
            title: 'Maintenance Records',
            content: 'Keep detailed records of all maintenance activities including costs, parts used, service provider, and next due date.'
          }
        ]
      }
    },
    {
      id: 'reports-analytics',
      label: 'Reports & Analytics',
      icon: BarChart3,
      content: {
        title: 'Reports & Analytics',
        description: 'Leverage data for better decision making',
        sections: [
          {
            title: 'Available Reports',
            content: 'Expense Reports • Fuel Efficiency • Vehicle Utilization • Driver Performance • Maintenance Costs • Profit & Loss'
          },
          {
            title: 'Custom Reports',
            content: 'Create custom reports with specific date ranges, vehicles, drivers, or expense categories. Export to PDF, Excel, or CSV.'
          },
          {
            title: 'AI Insights',
            content: 'Get AI-powered insights including anomaly detection, predictive maintenance, cost optimization recommendations, and trend analysis.'
          }
        ]
      }
    },
    {
      id: 'admin-guide',
      label: 'Admin Guide',
      icon: Shield,
      content: {
        title: 'Administrator Guide',
        description: 'System administration and configuration',
        sections: [
          {
            title: 'User Management',
            content: 'Add/remove users, assign roles (Admin, Fleet Manager, Dispatcher, Driver, Accountant), manage permissions.'
          },
          {
            title: 'System Settings',
            content: 'Configure system settings including company info, notification preferences, email templates, and integration settings.'
          },
          {
            title: 'Security',
            content: 'Manage API keys, configure authentication settings, set up two-factor authentication, and view audit logs.'
          }
        ]
      }
    },
    {
      id: 'api-reference',
      label: 'API Reference',
      icon: Code,
      content: {
        title: 'API Reference',
        description: 'Integrate with our REST API',
        sections: [
          {
            title: 'Authentication',
            content: 'All API requests require authentication using API keys. Include your API key in the Authorization header: Bearer YOUR_API_KEY'
          },
          {
            title: 'Base URL',
            content: 'https://api.mapsi-efms.com/v1',
            code: 'curl -X GET https://api.mapsi-efms.com/v1/vehicles \\\n  -H "Authorization: Bearer your-api-key"'
          },
          {
            title: 'Endpoints',
            content: '/vehicles - Vehicle management\n/expenses - Expense tracking\n/maintenance - Maintenance records\n/drivers - Driver management\n/reports - Report generation'
          },
          {
            title: 'Rate Limits',
            content: 'API rate limits: 1000 requests per hour per API key. Check response headers for rate limit status.'
          }
        ]
      }
    },
    {
      id: 'faq',
      label: 'FAQ',
      icon: FileText,
      content: {
        title: 'Frequently Asked Questions',
        description: 'Common questions and answers',
        sections: [
          {
            title: 'How do I reset my password?',
            content: 'Click on "Forgot Password" on the login page. Enter your email and follow the instructions sent to your inbox.'
          },
          {
            title: 'Can I access the system on mobile?',
            content: 'Yes, the system is fully responsive and works on all mobile devices. You can also download our mobile apps from App Store and Google Play.'
          },
          {
            title: 'How often is data backed up?',
            content: 'Data is backed up daily with 30-day retention. Critical data is also backed up in real-time to multiple locations.'
          },
          {
            title: 'Is my data secure?',
            content: 'Yes, all data is encrypted in transit (SSL/TLS) and at rest. We follow industry best practices for security and compliance.'
          }
        ]
      }
    }
  ];

  const filteredSections = sections.filter(section =>
    section.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.content.sections.some(s => 
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {sidebarOpen ? (
            <div className="flex items-center space-x-2">
              <Book className="h-6 w-6 text-red-600" />
              <span className="font-bold text-gray-800">Documentation</span>
            </div>
          ) : (
            <Book className="h-6 w-6 text-red-600 mx-auto" />
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {sidebarOpen && (
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search docs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setSelectedSection(section.id)}
              className={`w-full flex items-center px-4 py-3 text-sm transition-colors ${
                selectedSection === section.id
                  ? 'bg-red-50 text-red-600 border-r-2 border-red-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <section.icon className={`h-5 w-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">{section.label}</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {sections.find(s => s.id === selectedSection)?.content && (
          <div className="max-w-4xl mx-auto py-8 px-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {sections.find(s => s.id === selectedSection).content.title}
              </h1>
              <p className="text-lg text-gray-600">
                {sections.find(s => s.id === selectedSection).content.description}
              </p>
            </div>

            <div className="space-y-8">
              {sections.find(s => s.id === selectedSection).content.sections.map((section, index) => (
                <div key={index} className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">{section.title}</h2>
                  <p className="text-gray-600 whitespace-pre-line">{section.content}</p>
                  
                  {section.code && (
                    <div className="mt-4 bg-gray-900 rounded-lg p-4 relative">
                      <pre className="text-gray-100 text-sm overflow-x-auto">
                        <code>{section.code}</code>
                      </pre>
                      <button
                        onClick={() => copyToClipboard(section.code)}
                        className="absolute top-2 right-2 p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      >
                        {copied ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 bg-red-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Need more help?</h3>
              <p className="text-gray-600 mb-4">
                Can't find what you're looking for? Contact our support team for assistance.
              </p>
              <div className="flex space-x-4">
                <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                  Contact Support
                </button>
                <button className="border border-red-600 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 flex items-center">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View API Docs
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documentation;