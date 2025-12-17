/**
 * Dashboard - Main tool selection interface
 * Validates: Requirements 9.4
 */

import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Box,
  Chip,
  AppBar,
  Toolbar,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,

  useTheme,
  alpha,
} from '@mui/material'
import {
  Compress as CompressIcon,
  MergeType as MergeIcon,
  CallSplit as SplitIcon,
  TextFields as OCRIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  CloudOff as OfflineIcon,
  PhoneAndroid as MobileIcon,
  Info as InfoIcon,
  GitHub as GitHubIcon,
  Description as LicenseIcon,
} from '@mui/icons-material'

interface ToolCardProps {
  to: string;
  title: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  color: string;
}

const ToolCard: React.FC<ToolCardProps> = ({ to, title, description, features, icon, color }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Card 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        }
      }}
      onClick={() => navigate(to)}
    >
      <CardContent sx={{ flexGrow: 1, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box 
            sx={{ 
              p: 1.5, 
              borderRadius: 2, 
              backgroundColor: alpha(color, 0.1),
              color: color,
              mr: 2 
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" component="h3" fontWeight={600}>
            {title}
          </Typography>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {features.map((feature, index) => (
            <Chip
              key={index}
              label={feature}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          ))}
        </Box>
      </CardContent>
      
      <CardActions sx={{ p: 3, pt: 0 }}>
        <Button 
          variant="contained" 
          fullWidth 
          sx={{ 
            backgroundColor: color,
            '&:hover': {
              backgroundColor: alpha(color, 0.8),
            }
          }}
        >
          Open Tool
        </Button>
      </CardActions>
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const theme = useTheme();

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* App Bar */}
      <AppBar position="static" elevation={0} sx={{ backgroundColor: 'background.paper', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            PDF Toolkit
          </Typography>
          <IconButton color="inherit" href="https://github.com/your-repo/pdf-toolkit" target="_blank">
            <GitHubIcon />
          </IconButton>
          <IconButton color="inherit" component={Link} to="/attribution">
            <LicenseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Hero Section */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography 
            variant="h2" 
            component="h1" 
            gutterBottom
            sx={{ 
              fontWeight: 700,
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 2
            }}
          >
            Professional PDF Toolkit
          </Typography>
          
          <Typography 
            variant="h5" 
            color="text.secondary" 
            sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}
          >
            Privacy-first PDF processing tools that run entirely in your browser
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Chip icon={<SecurityIcon />} label="100% Private" color="success" />
            <Chip icon={<SpeedIcon />} label="No Upload Required" color="primary" />
            <Chip icon={<OfflineIcon />} label="Works Offline" color="info" />
            <Chip icon={<MobileIcon />} label="Mobile Friendly" color="secondary" />
          </Box>
        </Box>

        {/* Tools Grid */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          <Grid item xs={12} sm={6} lg={3}>
            <ToolCard
              to="/compress"
              title="Compress PDF"
              description="Reduce PDF file size with intelligent compression while maintaining quality"
              features={["Quality presets", "Large files", "Real-time progress"]}
              icon={<CompressIcon fontSize="large" />}
              color={theme.palette.primary.main}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} lg={3}>
            <ToolCard
              to="/merge"
              title="Merge PDFs"
              description="Combine multiple PDF files into a single document with drag-and-drop ordering"
              features={["Drag & drop", "Preserve dimensions", "Unlimited files"]}
              icon={<MergeIcon fontSize="large" />}
              color={theme.palette.success.main}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} lg={3}>
            <ToolCard
              to="/split"
              title="Split PDF"
              description="Extract specific pages or ranges from PDF documents with flexible options"
              features={["Page ranges", "Flexible syntax", "Multiple outputs"]}
              icon={<SplitIcon fontSize="large" />}
              color={theme.palette.warning.main}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} lg={3}>
            <ToolCard
              to="/ocr"
              title="OCR PDF"
              description="Convert scanned documents to searchable PDFs with optical character recognition"
              features={["Multi-language", "Searchable text", "High accuracy"]}
              icon={<OCRIcon fontSize="large" />}
              color={theme.palette.secondary.main}
            />
          </Grid>
        </Grid>

        {/* How It Works Section */}
        <Paper sx={{ p: 4, mb: 4 }}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ textAlign: 'center', mb: 4 }}>
            How It Works
          </Typography>
          
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Box 
                  sx={{ 
                    width: 80, 
                    height: 80, 
                    borderRadius: '50%', 
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2
                  }}
                >
                  <Typography variant="h4">📁</Typography>
                </Box>
                <Typography variant="h6" gutterBottom>1. Select Files</Typography>
                <Typography variant="body2" color="text.secondary">
                  Drag and drop or click to select your PDF files
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Box 
                  sx={{ 
                    width: 80, 
                    height: 80, 
                    borderRadius: '50%', 
                    backgroundColor: alpha(theme.palette.success.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2
                  }}
                >
                  <Typography variant="h4">⚙️</Typography>
                </Box>
                <Typography variant="h6" gutterBottom>2. Process Locally</Typography>
                <Typography variant="body2" color="text.secondary">
                  All processing happens in your browser - no uploads
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Box 
                  sx={{ 
                    width: 80, 
                    height: 80, 
                    borderRadius: '50%', 
                    backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2
                  }}
                >
                  <Typography variant="h4">💾</Typography>
                </Box>
                <Typography variant="h6" gutterBottom>3. Download Results</Typography>
                <Typography variant="body2" color="text.secondary">
                  Get your processed files instantly
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Features List */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            Why Choose PDF Toolkit?
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <SecurityIcon color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Complete Privacy" 
                    secondary="No data ever leaves your device"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <SpeedIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Lightning Fast" 
                    secondary="WebAssembly-powered processing"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <OfflineIcon color="info" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Works Offline" 
                    secondary="No internet connection required"
                  />
                </ListItem>
              </List>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <MobileIcon color="secondary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Mobile Friendly" 
                    secondary="Responsive design for all devices"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Open Source" 
                    secondary="Transparent and community-driven"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <GitHubIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Professional Grade" 
                    secondary="Enterprise-quality PDF processing"
                  />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  )
}

export default Dashboard