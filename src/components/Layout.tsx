/**
 * Layout Component - Modern application layout with navigation
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  IconButton,
  Breadcrumbs,
  Link,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Home as HomeIcon,
  GitHub as GitHubIcon,
  Description as LicenseIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title,
  showBackButton = false 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const getPageTitle = () => {
    if (title) return title;
    
    const path = location.pathname;
    switch (path) {
      case '/': return 'Dashboard';
      case '/compress': return 'Compress PDF';
      case '/merge': return 'Merge PDFs';
      case '/split': return 'Split PDF';
      case '/ocr': return 'OCR PDF';
      case '/attribution': return 'Licenses & Attribution';
      default: return 'PDF Toolkit';
    }
  };

  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/') return null;

    return (
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/')}
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' }
          }}
        >
          <HomeIcon sx={{ mr: 0.5, fontSize: 16 }} />
          Dashboard
        </Link>
        <Typography variant="body2" color="text.primary">
          {getPageTitle()}
        </Typography>
      </Breadcrumbs>
    );
  };

  const getToolColor = () => {
    const path = location.pathname;
    switch (path) {
      case '/compress': return theme.palette.primary.main;
      case '/merge': return theme.palette.success.main;
      case '/split': return theme.palette.warning.main;
      case '/ocr': return theme.palette.secondary.main;
      default: return theme.palette.primary.main;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* App Bar */}
      <AppBar 
        position="static" 
        elevation={0} 
        sx={{ 
          backgroundColor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Toolbar>
          {showBackButton && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => navigate(-1)}
              sx={{ mr: 2 }}
            >
              <BackIcon />
            </IconButton>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onClick={() => navigate('/')}
            >
              PDF Toolkit
            </Typography>
            
            {location.pathname !== '/' && (
              <Chip
                label={getPageTitle()}
                sx={{
                  ml: 2,
                  backgroundColor: alpha(getToolColor(), 0.1),
                  color: getToolColor(),
                  fontWeight: 600,
                }}
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton 
              color="inherit" 
              href="https://github.com/your-repo/pdf-toolkit" 
              target="_blank"
              size="small"
            >
              <GitHubIcon />
            </IconButton>
            <IconButton 
              color="inherit" 
              onClick={() => navigate('/attribution')}
              size="small"
            >
              <LicenseIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {getBreadcrumbs()}
        {children}
      </Container>
    </Box>
  );
};

export default Layout;