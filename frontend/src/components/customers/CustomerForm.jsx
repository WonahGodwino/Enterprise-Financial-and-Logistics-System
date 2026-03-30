import React, { useState } from 'react';
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
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  Divider
} from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  customerType: Yup.string().required('Customer type is required'),
  companyName: Yup.string().when('customerType', {
    is: 'ORGANIZATION',
    then: Yup.string().required('Company name is required')
  }),
  firstName: Yup.string().when('customerType', {
    is: 'INDIVIDUAL',
    then: Yup.string().required('First name is required')
  }),
  lastName: Yup.string().when('customerType', {
    is: 'INDIVIDUAL',
    then: Yup.string().required('Last name is required')
  }),
  email: Yup.string().email('Invalid email format'),
  phone: Yup.string().matches(/^[0-9+\-\s]{10,15}$/, 'Invalid phone number'),
  creditLimit: Yup.number().min(0, 'Credit limit must be positive')
});

export const CustomerForm = ({ open, onClose, onSubmit, initialData }) => {
  const [activeStep, setActiveStep] = useState(0);

  const formik = useFormik({
    initialValues: initialData || {
      customerType: 'INDIVIDUAL',
      companyName: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      alternativePhone: '',
      address: '',
      city: '',
      state: '',
      country: 'Nigeria',
      taxId: '',
      registrationNumber: '',
      contactPerson: '',
      contactPosition: '',
      notes: '',
      creditLimit: 0,
      paymentTerms: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      await onSubmit(values);
      onClose();
    }
  });

  const steps = ['Basic Information', 'Contact Details', 'Additional Info'];

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {initialData ? 'Edit Customer' : 'Add New Customer'}
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ py: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <form onSubmit={formik.handleSubmit}>
          {activeStep === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Customer Type</InputLabel>
                  <Select
                    name="customerType"
                    value={formik.values.customerType}
                    onChange={formik.handleChange}
                    error={formik.touched.customerType && Boolean(formik.errors.customerType)}
                  >
                    <MenuItem value="INDIVIDUAL">Individual</MenuItem>
                    <MenuItem value="ORGANIZATION">Organization</MenuItem>
                  </Select>
                  {formik.touched.customerType && formik.errors.customerType && (
                    <FormHelperText error>{formik.errors.customerType}</FormHelperText>
                  )}
                </FormControl>
              </Grid>

              {formik.values.customerType === 'ORGANIZATION' ? (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="companyName"
                      label="Company Name"
                      value={formik.values.companyName}
                      onChange={formik.handleChange}
                      error={formik.touched.companyName && Boolean(formik.errors.companyName)}
                      helperText={formik.touched.companyName && formik.errors.companyName}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      name="taxId"
                      label="Tax ID / VAT Number"
                      value={formik.values.taxId}
                      onChange={formik.handleChange}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      name="registrationNumber"
                      label="Registration Number"
                      value={formik.values.registrationNumber}
                      onChange={formik.handleChange}
                    />
                  </Grid>
                </>
              ) : (
                <>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      name="firstName"
                      label="First Name"
                      value={formik.values.firstName}
                      onChange={formik.handleChange}
                      error={formik.touched.firstName && Boolean(formik.errors.firstName)}
                      helperText={formik.touched.firstName && formik.errors.firstName}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      name="lastName"
                      label="Last Name"
                      value={formik.values.lastName}
                      onChange={formik.handleChange}
                      error={formik.touched.lastName && Boolean(formik.errors.lastName)}
                      helperText={formik.touched.lastName && formik.errors.lastName}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          )}

          {activeStep === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  name="email"
                  label="Email Address"
                  type="email"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  error={formik.touched.email && Boolean(formik.errors.email)}
                  helperText={formik.touched.email && formik.errors.email}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  name="phone"
                  label="Phone Number"
                  value={formik.values.phone}
                  onChange={formik.handleChange}
                  error={formik.touched.phone && Boolean(formik.errors.phone)}
                  helperText={formik.touched.phone && formik.errors.phone}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  name="alternativePhone"
                  label="Alternative Phone"
                  value={formik.values.alternativePhone}
                  onChange={formik.handleChange}
                />
              </Grid>
              {formik.values.customerType === 'ORGANIZATION' && (
                <>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      name="contactPerson"
                      label="Contact Person"
                      value={formik.values.contactPerson}
                      onChange={formik.handleChange}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      name="contactPosition"
                      label="Contact Position"
                      value={formik.values.contactPosition}
                      onChange={formik.handleChange}
                    />
                  </Grid>
                </>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="address"
                  label="Address"
                  multiline
                  rows={2}
                  value={formik.values.address}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  name="city"
                  label="City"
                  value={formik.values.city}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  name="state"
                  label="State"
                  value={formik.values.state}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  name="country"
                  label="Country"
                  value={formik.values.country}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
          )}

          {activeStep === 2 && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  name="creditLimit"
                  label="Credit Limit (₦)"
                  type="number"
                  value={formik.values.creditLimit}
                  onChange={formik.handleChange}
                  error={formik.touched.creditLimit && Boolean(formik.errors.creditLimit)}
                  helperText={formik.touched.creditLimit && formik.errors.creditLimit}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  name="paymentTerms"
                  label="Payment Terms"
                  placeholder="e.g., Net 30"
                  value={formik.values.paymentTerms}
                  onChange={formik.handleChange}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="notes"
                  label="Notes"
                  multiline
                  rows={4}
                  value={formik.values.notes}
                  onChange={formik.handleChange}
                />
              </Grid>
            </Grid>
          )}

          <DialogActions sx={{ mt: 2 }}>
            <Button onClick={onClose}>Cancel</Button>
            {activeStep > 0 && (
              <Button onClick={handleBack}>Back</Button>
            )}
            {activeStep < steps.length - 1 ? (
              <Button variant="contained" onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                type="submit"
                disabled={formik.isSubmitting}
              >
                {initialData ? 'Update' : 'Create'} Customer
              </Button>
            )}
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
};