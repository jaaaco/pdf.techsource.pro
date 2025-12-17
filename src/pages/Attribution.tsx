/**
 * Attribution Page - Licensing and attribution information
 * Validates: Requirements 9.4
 */

/**
 * Attribution Page - Licensing and attribution information
 * Validates: Requirements 9.4
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Paper,
  Grid,
  Alert,
  AlertTitle,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Gavel as LicenseIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  GitHub as GitHubIcon,
  LibraryBooks as LibraryIcon,
} from '@mui/icons-material';
import Layout from '@/components/Layout';

const Attribution: React.FC = () => {
  return (
    <Layout title="Attribution & Licenses" showBackButton>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>

        {/* Header */}
        <Paper sx={{ p: 4, mb: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
          <LicenseIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom fontWeight="bold">
            Attribution & Licenses
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Open source libraries and licensing information
          </Typography>
        </Paper>

        <Alert severity="info" sx={{ mb: 4 }} icon={<SecurityIcon />}>
          <AlertTitle>Privacy First</AlertTitle>
          All processing happens entirely in your browser. Your files never leave your device and no data is sent to any server.
        </Alert>

        {/* PDF Toolkit License */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CodeIcon sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="h6">
                PDF Toolkit License
              </Typography>
            </Box>
            <Typography variant="body1" paragraph>
              This project is open source and available under the MIT License.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You are free to use, modify, and distribute this software in accordance with the license terms.
            </Typography>
          </CardContent>
        </Card>

        {/* Third-Party Libraries */}
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          Third-Party Libraries
        </Typography>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Ghostscript */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ bgcolor: 'warning.50', borderColor: 'warning.200' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <LibraryIcon sx={{ mr: 1, color: 'warning.main' }} />
                  <Typography variant="h6" color="warning.dark">
                    Ghostscript (AGPL v3)
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 2, color: 'warning.dark' }}>
                  Used for PDF compression functionality.
                </Typography>

                <Alert severity="warning" sx={{ mb: 0 }}>
                  <AlertTitle>Important License Notice</AlertTitle>
                  Ghostscript is licensed under AGPL v3. If you distribute this software or run it as a service,
                  you must make the source code available under the same license.
                  For commercial use without AGPL obligations, consider obtaining a commercial Ghostscript license.
                </Alert>
              </CardContent>
            </Card>
          </Grid>

          {/* Tesseract */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom color="success.main">
                  Tesseract OCR (Apache 2.0)
                </Typography>
                <Typography variant="body2" paragraph>
                  Used for optical character recognition (OCR) functionality.
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Licensed under Apache License 2.0. Free for commercial and non-commercial use.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* PDF-lib */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary.main">
                  PDF-lib (MIT)
                </Typography>
                <Typography variant="body2" paragraph>
                  Used for PDF manipulation (merge, split) functionality.
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Licensed under MIT License. Free for all uses.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Other Dependencies */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Other Dependencies
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  React, TypeScript, Vite, React Router
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  All other dependencies are licensed under permissive licenses (MIT, Apache 2.0, BSD).
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Usage Guidelines */}
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
          Usage Guidelines
        </Typography>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <List>
              <ListItem alignItems="flex-start">
                <ListItemIcon><InfoIcon color="primary" /></ListItemIcon>
                <ListItemText
                  primary="For Personal Use"
                  secondary="You can use this software freely for personal, non-commercial purposes."
                />
              </ListItem>
              <Divider component="li" variant="inset" />
              <ListItem alignItems="flex-start">
                <ListItemIcon><WarningIcon color="warning" /></ListItemIcon>
                <ListItemText
                  primary="For Commercial Use"
                  secondaryTypographyProps={{ component: 'div' }}
                  secondary={
                    <>
                      <Typography component="span" variant="body2" color="text.secondary">
                        Due to Ghostscript's AGPL license, commercial use requires either:
                      </Typography>
                      <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
                        <li>Making your source code available under AGPL v3</li>
                        <li>Obtaining a commercial Ghostscript license</li>
                        <li>Removing Ghostscript-dependent features (compression)</li>
                      </ul>
                    </>
                  }
                />
              </ListItem>
              <Divider component="li" variant="inset" />
              <ListItem alignItems="flex-start">
                <ListItemIcon><InfoIcon color="info" /></ListItemIcon>
                <ListItemText
                  primary="For Distribution"
                  secondary="If you distribute this software, you must include all license notices and make source code available as required by the respective licenses."
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        {/* Contact */}
        <Alert severity="info" variant="outlined" sx={{ bgcolor: 'background.paper' }}>
          <AlertTitle>Questions?</AlertTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            If you have questions about licensing or need clarification:
            <Link
              href={`${import.meta.env.VITE_GITHUB_URL || 'https://github.com'}/issues`}
              target="_blank"
              rel="noopener"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <GitHubIcon fontSize="small" /> Open an issue on GitHub
            </Link>
          </Box>
        </Alert>

      </Box>
    </Layout>
  );
};

export default Attribution;
