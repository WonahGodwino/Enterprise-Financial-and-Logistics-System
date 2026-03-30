// frontend/src/components/help/HelpCenter.jsx
import React, { useState } from 'react';
import {
  HelpCircle,
  Search,
  MessageCircle,
  Mail,
  Phone,
  Video,
  FileText,
  BookOpen,
  Users,
  ChevronRight,
  Send,
  ThumbsUp,
  ThumbsDown,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const HelpCenter = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showContactForm, setShowContactForm] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const categories = [
    { id: 'all', label: 'All Topics', icon: HelpCircle },
    { id: 'getting-started', label: 'Getting Started', icon: BookOpen },
    { id: 'account', label: 'Account & Billing', icon: Users },
    { id: 'technical', label: 'Technical Support', icon: FileText },
    { id: 'features', label: 'Features & How-to', icon: Video },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertCircle }
  ];

  const articles = [
    {
      id: 1,
      title: 'How to add a new vehicle to your fleet',
      category: 'getting-started',
      views: 1234,
      helpful: 45,
      lastUpdated: '2026-03-01'
    },
    {
      id: 2,
      title: 'Setting up user roles and permissions',
      category: 'account',
      views: 892,
      helpful: 32,
      lastUpdated: '2026-02-28'
    },
    {
      id: 3,
      title: 'Troubleshooting login issues',
      category: 'troubleshooting',
      views: 2341,
      helpful: 67,
      lastUpdated: '2026-03-05'
    },
    {
      id: 4,
      title: 'Generating expense reports',
      category: 'features',
      views: 1567,
      helpful: 53,
      lastUpdated: '2026-02-25'
    },
    {
      id: 5,
      title: 'API integration guide',
      category: 'technical',
      views: 678,
      helpful: 21,
      lastUpdated: '2026-03-02'
    },
    {
      id: 6,
      title: 'Maintenance scheduling best practices',
      category: 'features',
      views: 945,
      helpful: 38,
      lastUpdated: '2026-02-27'
    }
  ];

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const faqs = [
    {
      question: 'How do I reset my password?',
      answer: 'Click on "Forgot Password" on the login page and follow the instructions sent to your email.'
    },
    {
      question: 'What browsers are supported?',
      answer: 'We support all modern browsers including Chrome, Firefox, Safari, and Edge.'
    },
    {
      question: 'How often is data backed up?',
      answer: 'Data is backed up daily with 30-day retention. Critical data is backed up in real-time.'
    },
    {
      question: 'Can I export reports to Excel?',
      answer: 'Yes, all reports can be exported to Excel, PDF, and CSV formats.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-4">How can we help you?</h1>
        <div className="max-w-2xl relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search for answers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Browse by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`p-4 rounded-lg text-center transition-colors ${
                selectedCategory === category.id
                  ? 'bg-red-50 border-2 border-red-500'
                  : 'border-2 border-transparent hover:bg-gray-50'
              }`}
            >
              <category.icon className={`h-6 w-6 mx-auto mb-2 ${
                selectedCategory === category.id ? 'text-red-600' : 'text-gray-600'
              }`} />
              <span className={`text-sm font-medium ${
                selectedCategory === category.id ? 'text-red-600' : 'text-gray-700'
              }`}>
                {category.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Popular Articles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Popular Articles</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {filteredArticles.map(article => (
                <div key={article.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-medium text-gray-900 mb-2">
                        {article.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          Updated {article.lastUpdated}
                        </span>
                        <span className="flex items-center">
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          {article.helpful} helpful
                        </span>
                        <span>{article.views} views</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))}

              {filteredArticles.length === 0 && (
                <div className="text-center py-8">
                  <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No articles found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => setShowContactForm(true)}
                className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 flex items-center"
              >
                <MessageCircle className="h-5 w-5 text-red-600 mr-3" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Live Chat</div>
                  <div className="text-xs text-gray-500">Available 24/7</div>
                </div>
              </button>

              <a
                href="mailto:support@mapsi-efms.com"
                className="block px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 flex items-center"
              >
                <Mail className="h-5 w-5 text-red-600 mr-3" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Email Support</div>
                  <div className="text-xs text-gray-500">support@mapsi-efms.com</div>
                </div>
              </a>

              <a
                href="tel:+1234567890"
                className="block px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 flex items-center"
              >
                <Phone className="h-5 w-5 text-red-600 mr-3" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Phone Support</div>
                  <div className="text-xs text-gray-500">Mon-Fri, 9am-6pm</div>
                </div>
              </a>

              <button className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 flex items-center">
                <Video className="h-5 w-5 text-red-600 mr-3" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Video Tutorials</div>
                  <div className="text-xs text-gray-500">Watch guides</div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">System Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Services</span>
                <span className="flex items-center text-green-600">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <span className="flex items-center text-green-600">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">File Storage</span>
                <span className="flex items-center text-green-600">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Email Service</span>
                <span className="flex items-center text-yellow-600">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Degraded
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border border-gray-200 rounded-lg">
              <button
                onClick={() => setFeedback(feedback === index ? null : index)}
                className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{faq.question}</span>
                <ChevronRight className={`h-5 w-5 text-gray-500 transform transition-transform ${
                  feedback === index ? 'rotate-90' : ''
                }`} />
              </button>
              {feedback === index && (
                <div className="px-4 pb-3">
                  <p className="text-gray-600 text-sm">{faq.answer}</p>
                  <div className="mt-3 flex items-center space-x-4">
                    <span className="text-xs text-gray-500">Was this helpful?</span>
                    <button className="text-gray-500 hover:text-green-600">
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button className="text-gray-500 hover:text-red-600">
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Contact Support</h2>
            </div>
            <form className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Brief description of your issue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option>Technical Issue</option>
                  <option>Billing Question</option>
                  <option>Feature Request</option>
                  <option>Account Management</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Describe your issue in detail..."
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attachments (optional)
                </label>
                <input
                  type="file"
                  multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowContactForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpCenter;