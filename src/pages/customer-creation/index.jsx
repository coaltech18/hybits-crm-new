import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';

const CustomerCreation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, sidebarCollapsed, toggleSidebar } = useAuth();
  
  // Get customer data from location state if editing existing customer
  const selectedCustomer = location.state?.customer || null;

  const [formData, setFormData] = useState({
    // Basic Information
    customerCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    alternatePhone: '',
    dateOfBirth: '',
    gender: '',
    
    // Company Information
    companyName: '',
    designation: '',
    department: '',
    industry: '',
    companySize: '',
    
    // Address Information
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    
    // Business Information
    customerType: 'individual', // individual, business, corporate
    customerStatus: 'active', // active, inactive, prospect, lead
    leadSource: 'website', // website, referral, social, cold-call, event, other
    assignedTo: '',
    priority: 'medium', // low, medium, high, urgent
    
    // Communication Preferences
    preferredContactMethod: 'phone', // phone, email, sms, whatsapp
    preferredLanguage: 'english', // english, hindi, regional
    marketingConsent: false,
    smsConsent: false,
    
    // Additional Information
    notes: '',
    tags: '',
    website: '',
    socialMedia: {
      linkedin: '',
      facebook: '',
      twitter: '',
      instagram: ''
    },
    
    // Financial Information
    creditLimit: 0,
    paymentTerms: 'net-30', // net-15, net-30, net-45, net-60, cash, advance
    taxExempt: false,
    gstNumber: '',
    panNumber: '',
    
    // Relationship Information
    relationshipManager: '',
    lastContactDate: '',
    nextFollowUpDate: '',
    customerSince: '',
    
    // Preferences
    preferredDeliveryTime: 'morning', // morning, afternoon, evening, any
    preferredPaymentMethod: 'bank-transfer', // cash, cheque, bank-transfer, upi, card
    specialInstructions: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  // Mock data for dropdowns
  const customerTypes = [
    { value: 'individual', label: 'Individual' },
    { value: 'business', label: 'Small Business' },
    { value: 'corporate', label: 'Corporate' }
  ];

  const customerStatuses = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'prospect', label: 'Prospect' },
    { value: 'lead', label: 'Lead' }
  ];

  const leadSources = [
    { value: 'website', label: 'Website' },
    { value: 'referral', label: 'Referral' },
    { value: 'social', label: 'Social Media' },
    { value: 'cold-call', label: 'Cold Call' },
    { value: 'event', label: 'Event/Exhibition' },
    { value: 'advertisement', label: 'Advertisement' },
    { value: 'other', label: 'Other' }
  ];

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' }
  ];

  const contactMethods = [
    { value: 'phone', label: 'Phone' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'whatsapp', label: 'WhatsApp' }
  ];

  const languages = [
    { value: 'english', label: 'English' },
    { value: 'hindi', label: 'Hindi' },
    { value: 'tamil', label: 'Tamil' },
    { value: 'telugu', label: 'Telugu' },
    { value: 'bengali', label: 'Bengali' },
    { value: 'marathi', label: 'Marathi' },
    { value: 'gujarati', label: 'Gujarati' }
  ];

  const paymentTerms = [
    { value: 'net-15', label: 'Net 15 Days' },
    { value: 'net-30', label: 'Net 30 Days' },
    { value: 'net-45', label: 'Net 45 Days' },
    { value: 'net-60', label: 'Net 60 Days' },
    { value: 'cash', label: 'Cash on Delivery' },
    { value: 'advance', label: 'Advance Payment' }
  ];

  const deliveryTimes = [
    { value: 'morning', label: 'Morning (8 AM - 12 PM)' },
    { value: 'afternoon', label: 'Afternoon (12 PM - 5 PM)' },
    { value: 'evening', label: 'Evening (5 PM - 8 PM)' },
    { value: 'any', label: 'Any Time' }
  ];

  const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'bank-transfer', label: 'Bank Transfer' },
    { value: 'upi', label: 'UPI' },
    { value: 'card', label: 'Credit/Debit Card' }
  ];

  const relationshipManagers = [
    { id: 1, name: 'Rajesh Kumar', email: 'rajesh@hybits.com' },
    { id: 2, name: 'Priya Sharma', email: 'priya@hybits.com' },
    { id: 3, name: 'Amit Singh', email: 'amit@hybits.com' },
    { id: 4, name: 'Sneha Patel', email: 'sneha@hybits.com' }
  ];

  const industries = [
    'Technology', 'Healthcare', 'Education', 'Manufacturing', 'Retail',
    'Hospitality', 'Real Estate', 'Finance', 'Automotive', 'Food & Beverage',
    'Entertainment', 'Construction', 'Logistics', 'Consulting', 'Other'
  ];

  const companySizes = [
    '1-10 employees', '11-50 employees', '51-200 employees',
    '201-500 employees', '501-1000 employees', '1000+ employees'
  ];

  const states = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal', 'Delhi', 'Chandigarh', 'Puducherry'
  ];

  useEffect(() => {
    // Generate customer code if creating new customer
    if (!selectedCustomer) {
      const customerCode = `CUST-${Date.now().toString().slice(-6)}`;
      setFormData(prev => ({
        ...prev,
        customerCode,
        customerSince: new Date().toISOString().split('T')[0]
      }));
    } else {
      // Editing existing customer
      setIsEditing(true);
      setFormData(prev => ({
        ...prev,
        ...selectedCustomer
      }));
    }
  }, [selectedCustomer]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSocialMediaChange = (platform, value) => {
    setFormData(prev => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: value
      }
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields validation
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.addressLine1.trim()) newErrors.addressLine1 = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.pincode.trim()) newErrors.pincode = 'Pincode is required';
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Phone validation
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (formData.phone && !phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    // Pincode validation
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    if (formData.pincode && !pincodeRegex.test(formData.pincode)) {
      newErrors.pincode = 'Please enter a valid 6-digit pincode';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const customerData = {
        ...formData,
        fullName: `${formData.firstName} ${formData.lastName}`,
        createdBy: userProfile?.id,
        createdAt: isEditing ? selectedCustomer.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // In a real app, you'd save to database here
      console.log(isEditing ? 'Updating customer:' : 'Creating customer:', customerData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate back to customer management
      navigate('/customer-relationship-management', { 
        state: { 
          message: isEditing ? 'Customer updated successfully' : 'Customer created successfully',
          newCustomer: customerData
        }
      });
    } catch (error) {
      console.error('Error saving customer:', error);
      setErrors({ general: 'Failed to save customer. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/customer-relationship-management');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={userProfile}
        onLogout={() => navigate('/')}
      />
      <Sidebar 
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={userProfile}
      />
      <main className={`transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-70'
      } pt-16`}>
        <div className="p-6">
          <Breadcrumb />
          
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isEditing ? 'Edit Customer' : 'Create New Customer'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditing ? 'Update customer information' : 'Add a new customer to your database'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                loading={loading}
                iconName="Save"
                iconPosition="left"
              >
                {isEditing ? 'Update Customer' : 'Create Customer'}
              </Button>
            </div>
          </div>

          {errors.general && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{errors.general}</p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="xl:col-span-2 space-y-6">
              {/* Basic Information */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Basic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Customer Code
                    </label>
                    <Input
                      value={formData.customerCode}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Customer Type
                    </label>
                    <Select
                      value={formData.customerType}
                      onChange={(e) => handleInputChange('customerType', e.target.value)}
                    >
                      {customerTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      First Name *
                    </label>
                    <Input
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      placeholder="Enter first name"
                      error={errors.firstName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Last Name *
                    </label>
                    <Input
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Enter last name"
                      error={errors.lastName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email Address *
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="customer@example.com"
                      error={errors.email}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Phone Number *
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+91 98765 43210"
                      error={errors.phone}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Alternate Phone
                    </label>
                    <Input
                      value={formData.alternatePhone}
                      onChange={(e) => handleInputChange('alternatePhone', e.target.value)}
                      placeholder="+91 87654 32109"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Date of Birth
                    </label>
                    <Input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Gender
                    </label>
                    <Select
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Company Information */}
              {formData.customerType !== 'individual' && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Company Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Company Name
                      </label>
                      <Input
                        value={formData.companyName}
                        onChange={(e) => handleInputChange('companyName', e.target.value)}
                        placeholder="Enter company name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Designation
                      </label>
                      <Input
                        value={formData.designation}
                        onChange={(e) => handleInputChange('designation', e.target.value)}
                        placeholder="e.g., Manager, Director"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Department
                      </label>
                      <Input
                        value={formData.department}
                        onChange={(e) => handleInputChange('department', e.target.value)}
                        placeholder="e.g., Operations, Marketing"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Industry
                      </label>
                      <Select
                        value={formData.industry}
                        onChange={(e) => handleInputChange('industry', e.target.value)}
                      >
                        <option value="">Select Industry</option>
                        {industries.map(industry => (
                          <option key={industry} value={industry}>
                            {industry}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Company Size
                      </label>
                      <Select
                        value={formData.companySize}
                        onChange={(e) => handleInputChange('companySize', e.target.value)}
                      >
                        <option value="">Select Company Size</option>
                        {companySizes.map(size => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Address Information */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Address Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Address Line 1 *
                    </label>
                    <Input
                      value={formData.addressLine1}
                      onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                      placeholder="Street address, building name"
                      error={errors.addressLine1}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Address Line 2
                    </label>
                    <Input
                      value={formData.addressLine2}
                      onChange={(e) => handleInputChange('addressLine2', e.target.value)}
                      placeholder="Apartment, suite, unit, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      City *
                    </label>
                    <Input
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Enter city"
                      error={errors.city}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      State *
                    </label>
                    <Select
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      error={errors.state}
                    >
                      <option value="">Select State</option>
                      {states.map(state => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Pincode *
                    </label>
                    <Input
                      value={formData.pincode}
                      onChange={(e) => handleInputChange('pincode', e.target.value)}
                      placeholder="123456"
                      error={errors.pincode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Country
                    </label>
                    <Input
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Business Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Customer Status
                    </label>
                    <Select
                      value={formData.customerStatus}
                      onChange={(e) => handleInputChange('customerStatus', e.target.value)}
                    >
                      {customerStatuses.map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Lead Source
                    </label>
                    <Select
                      value={formData.leadSource}
                      onChange={(e) => handleInputChange('leadSource', e.target.value)}
                    >
                      {leadSources.map(source => (
                        <option key={source.value} value={source.value}>
                          {source.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Priority
                    </label>
                    <Select
                      value={formData.priority}
                      onChange={(e) => handleInputChange('priority', e.target.value)}
                    >
                      {priorities.map(priority => (
                        <option key={priority.value} value={priority.value}>
                          {priority.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Relationship Manager
                    </label>
                    <Select
                      value={formData.relationshipManager}
                      onChange={(e) => handleInputChange('relationshipManager', e.target.value)}
                    >
                      <option value="">Select Relationship Manager</option>
                      {relationshipManagers.map(manager => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Customer Since
                    </label>
                    <Input
                      type="date"
                      value={formData.customerSince}
                      onChange={(e) => handleInputChange('customerSince', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Last Contact Date
                    </label>
                    <Input
                      type="date"
                      value={formData.lastContactDate}
                      onChange={(e) => handleInputChange('lastContactDate', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Communication Preferences */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Communication Preferences</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Preferred Contact Method
                    </label>
                    <Select
                      value={formData.preferredContactMethod}
                      onChange={(e) => handleInputChange('preferredContactMethod', e.target.value)}
                    >
                      {contactMethods.map(method => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Preferred Language
                    </label>
                    <Select
                      value={formData.preferredLanguage}
                      onChange={(e) => handleInputChange('preferredLanguage', e.target.value)}
                    >
                      {languages.map(language => (
                        <option key={language.value} value={language.value}>
                          {language.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <div className="space-y-3">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.marketingConsent}
                          onChange={(e) => handleInputChange('marketingConsent', e.target.checked)}
                          className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                        />
                        <span className="text-sm text-foreground">Marketing Communications Consent</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.smsConsent}
                          onChange={(e) => handleInputChange('smsConsent', e.target.checked)}
                          className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                        />
                        <span className="text-sm text-foreground">SMS Notifications Consent</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Information */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Financial Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Credit Limit (₹)
                    </label>
                    <Input
                      type="number"
                      value={formData.creditLimit}
                      onChange={(e) => handleInputChange('creditLimit', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Payment Terms
                    </label>
                    <Select
                      value={formData.paymentTerms}
                      onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                    >
                      {paymentTerms.map(term => (
                        <option key={term.value} value={term.value}>
                          {term.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      GST Number
                    </label>
                    <Input
                      value={formData.gstNumber}
                      onChange={(e) => handleInputChange('gstNumber', e.target.value)}
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      PAN Number
                    </label>
                    <Input
                      value={formData.panNumber}
                      onChange={(e) => handleInputChange('panNumber', e.target.value)}
                      placeholder="AAAAA0000A"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.taxExempt}
                        onChange={(e) => handleInputChange('taxExempt', e.target.checked)}
                        className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">Tax Exempt</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Social Media & Web Presence */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Social Media & Web Presence</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Website
                    </label>
                    <Input
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      placeholder="https://www.example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      LinkedIn
                    </label>
                    <Input
                      value={formData.socialMedia.linkedin}
                      onChange={(e) => handleSocialMediaChange('linkedin', e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Facebook
                    </label>
                    <Input
                      value={formData.socialMedia.facebook}
                      onChange={(e) => handleSocialMediaChange('facebook', e.target.value)}
                      placeholder="https://facebook.com/username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Twitter
                    </label>
                    <Input
                      value={formData.socialMedia.twitter}
                      onChange={(e) => handleSocialMediaChange('twitter', e.target.value)}
                      placeholder="https://twitter.com/username"
                    />
                  </div>
                </div>
              </div>

              {/* Preferences */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Preferences</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Preferred Delivery Time
                    </label>
                    <Select
                      value={formData.preferredDeliveryTime}
                      onChange={(e) => handleInputChange('preferredDeliveryTime', e.target.value)}
                    >
                      {deliveryTimes.map(time => (
                        <option key={time.value} value={time.value}>
                          {time.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Preferred Payment Method
                    </label>
                    <Select
                      value={formData.preferredPaymentMethod}
                      onChange={(e) => handleInputChange('preferredPaymentMethod', e.target.value)}
                    >
                      {paymentMethods.map(method => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Special Instructions
                    </label>
                    <textarea
                      value={formData.specialInstructions}
                      onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                      placeholder="Any special instructions or notes about this customer"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Additional Notes</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Additional notes about the customer"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Tags
                    </label>
                    <Input
                      value={formData.tags}
                      onChange={(e) => handleInputChange('tags', e.target.value)}
                      placeholder="Enter tags separated by commas (e.g., vip, corporate, regular)"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Summary */}
            <div className="xl:col-span-1">
              <div className="bg-card border border-border rounded-lg p-6 sticky top-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Customer Summary</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer Code:</span>
                    <span className="font-medium">{formData.customerCode}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Full Name:</span>
                    <span className="font-medium">
                      {formData.firstName && formData.lastName 
                        ? `${formData.firstName} ${formData.lastName}` 
                        : 'Not set'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer Type:</span>
                    <span className="font-medium">
                      {customerTypes.find(t => t.value === formData.customerType)?.label || 'Not set'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium">
                      {customerStatuses.find(s => s.value === formData.customerStatus)?.label || 'Not set'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Priority:</span>
                    <span className="font-medium">
                      {priorities.find(p => p.value === formData.priority)?.label || 'Not set'}
                    </span>
                  </div>
                  
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium text-xs">{formData.email || 'Not set'}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-medium text-xs">{formData.phone || 'Not set'}</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">City:</span>
                      <span className="font-medium">{formData.city || 'Not set'}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">State:</span>
                      <span className="font-medium">{formData.state || 'Not set'}</span>
                    </div>
                  </div>
                  
                  {formData.customerType !== 'individual' && (
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Company:</span>
                        <span className="font-medium">{formData.companyName || 'Not set'}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Industry:</span>
                        <span className="font-medium">{formData.industry || 'Not set'}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    onClick={handleSave}
                    loading={loading}
                    className="w-full"
                    iconName="Save"
                    iconPosition="left"
                  >
                    {isEditing ? 'Update Customer' : 'Create Customer'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={loading}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomerCreation;
