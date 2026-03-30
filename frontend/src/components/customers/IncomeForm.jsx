import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  InputAdornment,
  Autocomplete,
  Chip,
  Box,
  Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import api from '../../services/api';

const MAIN_SUBSIDIARY_CODE = 'MAIN';

const validationSchema = Yup.object({
  incomeType: Yup.string().required('Income type is required'),
  category: Yup.string().required('Category is required'),
  amount: Yup.number().positive('Amount must be positive').required('Amount is required'),
  incomeDate: Yup.date().required('Date is required').max(new Date(), 'Date cannot be in future'),
  customerId: Yup.string().uuid('Invalid customer').optional(),
  vehicleId: Yup.string().uuid('Invalid vehicle').optional(),
  subsidiaryId: Yup.string().required('Subsidiary is required'),
  serviceDescription: Yup.string().max(1000, 'Description too long'),
  paymentStatus: Yup.string().required('Payment status is required')
});

export const IncomeForm = ({ open, onClose, onSubmit, initialData }) => {
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [loading, setLoading] = useState(false);

  const formatSubsidiaryLabel = (subsidiary) => {
    const isMain = String(subsidiary?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
    if (isMain) return `${subsidiary.name} (Main)`;
    return `${subsidiary.name}${subsidiary?.code ? ` (${subsidiary.code})` : ''}`;
  };

  useEffect(() => {
    if (open) {
      fetchFormData();
    }
  }, [open]);

  const fetchFormData = async () => {
    setLoading(true);
    try {
      const [customersRes, vehiclesRes, subsidiariesRes] = await Promise.all([
        api.get('/customers?limit=100'),
        api.get('/vehicles?limit=100'),
        api.get('/subsidiaries')
      ]);
      
      setCustomers(customersRes.data.data || []);
      setVehicles(vehiclesRes.data.data || []);
      const rawSubs = subsidiariesRes.data.data || subsidiariesRes.data || [];
      setSubsidiaries(
        [...rawSubs].sort((a, b) => {
          const aIsMain = String(a?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
          const bIsMain = String(b?.code || '').toUpperCase() === MAIN_SUBSIDIARY_CODE;
          if (aIsMain && !bIsMain) return -1;
          if (!aIsMain && bIsMain) return 1;
          return String(a?.name || '').localeCompare(String(b?.name || ''));
        })
      );
    } catch (error) {
      console.error('Error fetching form data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formik = useFormik({
    initialValues: initialData || {
      incomeType: '',
      category: '',
      amount: '',
      taxAmount: 0,
      discountAmount: 0,
      currency: 'NGN',
      incomeDate: new Date(),
      dueDate: null,
      customerId: '',
      vehicleId: '',
      subsidiaryId: '',
      serviceType: '',
      serviceDescription: '',
      quantity: 1,
      unitPrice: '',
      paymentStatus: 'PENDING',
      paymentMethod: '',
      paymentReference: '',
      notes: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      const submissionData = {
        ...values,
        amount: parseFloat(values.amount),
        taxAmount: parseFloat(values.taxAmount || 0),
        discountAmount: parseFloat(values.discountAmount || 0),
        quantity: values.quantity ? parseFloat(values.quantity) : undefined,
        unitPrice: values.unitPrice ? parseFloat(values.unitPrice) : undefined
      };
      await onSubmit(submissionData);
      onClose();
    }
  });

  // Calculate net amount
  const netAmount = 
    parseFloat(formik.values.amount || 0) - 
    parseFloat(formik.values.taxAmount || 0) - 
    parseFloat(formik.values.discountAmount || 0);

  // Category options based on income type
  const getCategoryOptions = () => {
    const categories = {
      'CAR_HIRE': ['CAR_HIRE'],
      'CAR_SALES': ['CAR_SALES'],
      'CAR_MAINTENANCE': ['CAR_MAINTENANCE'],
      'SECURITY_GUARD': ['SECURITY_GUARD'],
      'CCTV_INSTALLATION': ['CCTV_INSTALLATION'],
      'SMART_HOME': ['SMART_HOME'],
      'SECURITY_CONSULTING': ['SECURITY_CONSULTING'],
      'GENERAL_CONTRACT': ['GENERAL_CONTRACT'],
      'RENOVATION': ['RENOVATION'],
      'CONSTRUCTION_MATERIALS': ['CONSTRUCTION_MATERIALS'],
      'PROJECT_MANAGEMENT': ['PROJECT_MANAGEMENT']
    };
    return categories[formik.values.incomeType] || ['OTHER'];
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {initialData ? 'Edit Income' : 'Record New Income'}
      </DialogTitle>
      <DialogContent>
        <form onSubmit={formik.handleSubmit}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Income Type and Category */}
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Income Type</InputLabel>
                <Select
                  name="incomeType"
                  value={formik.values.incomeType}
                  onChange={formik.handleChange}
                  error={formik.touched.incomeType && Boolean(formik.errors.incomeType)}
                >
                  <MenuItem value="SERVICE">Service</MenuItem>
                  <MenuItem value="PRODUCT">Product</MenuItem>
                  <MenuItem value="RENTAL">Rental</MenuItem>
                  <MenuItem value="INSTALLATION">Installation</MenuItem>
                  <MenuItem value="MAINTENANCE">Maintenance</MenuItem>
                  <MenuItem value="CONSULTING">Consulting</MenuItem>
                  <MenuItem value="OTHER">Other</MenuItem>
                </Select>
                {formik.touched.incomeType && formik.errors.incomeType && (
                  <FormHelperText error>{formik.errors.incomeType}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  name="category"
                  value={formik.values.category}
                  onChange={formik.handleChange}
                  error={formik.touched.category && Boolean(formik.errors.category)}
                >
                  {getCategoryOptions().map(cat => (
                    <MenuItem key={cat} value={cat}>
                      {cat.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
                {formik.touched.category && formik.errors.category && (
                  <FormHelperText error>{formik.errors.category}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* Customer Selection */}
            <Grid item xs={12}>
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => 
                  option.customerType === 'ORGANIZATION' 
                    ? option.companyName 
                    : `${option.firstName} ${option.lastName}`
                }
                value={customers.find(c => c.id === formik.values.customerId) || null}
                onChange={(e, value) => formik.setFieldValue('customerId', value?.id || '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Customer (Optional)"
                    placeholder="Search customer..."
                  />
                )}
              />
            </Grid>

            {/* Vehicle and Subsidiary */}
            <Grid item xs={6}>
              <Autocomplete
                options={vehicles}
                getOptionLabel={(option) => `${option.registrationNumber} - ${option.model}`}
                value={vehicles.find(v => v.id === formik.values.vehicleId) || null}
                onChange={(e, value) => formik.setFieldValue('vehicleId', value?.id || '')}
                renderInput={(params) => (
                  <TextField {...params} label="Vehicle (Optional)" />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth error={formik.touched.subsidiaryId && Boolean(formik.errors.subsidiaryId)}>
                <InputLabel>Subsidiary *</InputLabel>
                <Select
                  name="subsidiaryId"
                  value={formik.values.subsidiaryId}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                >
                  <MenuItem value="">Select subsidiary</MenuItem>
                  {subsidiaries.map(sub => (
                    <MenuItem key={sub.id} value={sub.id}>{formatSubsidiaryLabel(sub)}</MenuItem>
                  ))}
                </Select>
                {formik.touched.subsidiaryId && formik.errors.subsidiaryId && (
                  <FormHelperText>{formik.errors.subsidiaryId}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* Amount Details */}
            <Grid item xs={4}>
              <TextField
                fullWidth
                name="amount"
                label="Amount"
                type="number"
                value={formik.values.amount}
                onChange={formik.handleChange}
                error={formik.touched.amount && Boolean(formik.errors.amount)}
                helperText={formik.touched.amount && formik.errors.amount}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₦</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                name="taxAmount"
                label="Tax"
                type="number"
                value={formik.values.taxAmount}
                onChange={formik.handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₦</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                name="discountAmount"
                label="Discount"
                type="number"
                value={formik.values.discountAmount}
                onChange={formik.handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₦</InputAdornment>
                }}
              />
            </Grid>

            {/* Net Amount Display */}
            <Grid item xs={12}>
              <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 1 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  Net Amount
                </Typography>
                <Typography variant="h6" color="primary">
                  ₦{netAmount.toLocaleString()}
                </Typography>
              </Box>
            </Grid>

            {/* Dates */}
            <Grid item xs={6}>
              <DatePicker
                label="Income Date"
                value={formik.values.incomeDate}
                onChange={(date) => formik.setFieldValue('incomeDate', date)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    error={formik.touched.incomeDate && Boolean(formik.errors.incomeDate)}
                    helperText={formik.touched.incomeDate && formik.errors.incomeDate}
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <DatePicker
                label="Due Date (Optional)"
                value={formik.values.dueDate}
                onChange={(date) => formik.setFieldValue('dueDate', date)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>

            {/* Service Details */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="serviceType"
                label="Service Type"
                value={formik.values.serviceType}
                onChange={formik.handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="serviceDescription"
                label="Description"
                multiline
                rows={2}
                value={formik.values.serviceDescription}
                onChange={formik.handleChange}
              />
            </Grid>

            {/* Quantity and Unit Price */}
            <Grid item xs={6}>
              <TextField
                fullWidth
                name="quantity"
                label="Quantity"
                type="number"
                value={formik.values.quantity}
                onChange={formik.handleChange}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                name="unitPrice"
                label="Unit Price"
                type="number"
                value={formik.values.unitPrice}
                onChange={formik.handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₦</InputAdornment>
                }}
              />
            </Grid>

            <Divider sx={{ my: 2, width: '100%' }} />

            {/* Payment Status */}
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Status</InputLabel>
                <Select
                  name="paymentStatus"
                  value={formik.values.paymentStatus}
                  onChange={formik.handleChange}
                >
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="PARTIALLY_PAID">Partially Paid</MenuItem>
                  <MenuItem value="PAID">Paid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  name="paymentMethod"
                  value={formik.values.paymentMethod}
                  onChange={formik.handleChange}
                >
                  <MenuItem value="CASH">Cash</MenuItem>
                  <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                  <MenuItem value="CHEQUE">Cheque</MenuItem>
                  <MenuItem value="POS">POS</MenuItem>
                  <MenuItem value="CREDIT_CARD">Credit Card</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Payment Reference */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="paymentReference"
                label="Payment Reference"
                value={formik.values.paymentReference}
                onChange={formik.handleChange}
              />
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="notes"
                label="Notes"
                multiline
                rows={2}
                value={formik.values.notes}
                onChange={formik.handleChange}
              />
            </Grid>
          </Grid>

          <DialogActions sx={{ mt: 2 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={formik.isSubmitting}
            >
              {initialData ? 'Update' : 'Record'} Income
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
};