/**
 * ToolLayout Component - Shared layout for all tool pages
 * Modern 2026 design system integration
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  IconButton,
  alpha,
  useTheme,
  Paper
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  GitHub as GitHubIcon,
  Description as LicenseIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import ErrorBoundary from './ErrorBoundary';

export interface ToolLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
  toolName?: string;
  showNavigation?: boolean;
  showAttribution?: boolean;
  className?: string;
}

const ToolLayout: React.FC<ToolLayoutProps> = ({
  children,
  title,
  description,
  toolName,
  showNavigation = true,
  showAttribution = true,
  className = ''
}) => {
  const location = useLocation();
  const theme = useTheme();

  const tools = [
    { path: '/compress', name: 'Compress' },
    { path: '/merge', name: 'Merge' },
    { path: '/split', name: 'Split' },
    { path: '/ocr', name: 'OCR' }
  ];

  return (
    <Box className={className} sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Background Glow */}
      <div className="page-glow" />

      {/* Header */}
      <AppBar position="sticky" elevation={0} sx={{ background: alpha(theme.palette.background.default, 0.7), backdropFilter: 'blur(20px)' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              component={Link}
              to="/"
              edge="start"
              color="inherit"
              size="small"
              sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}
            >
              <BackIcon fontSize="small" />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'primary.main' }}>
              PDF.KIT
            </Typography>
            {toolName && (
              <Box sx={{ display: 'none', sm: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.disabled">/</Typography>
                <Typography variant="body2" fontWeight={700} color="text.secondary">{toolName}</Typography>
              </Box>
            )}
          </Box>

          {showNavigation && (
            <Box sx={{ display: 'none', lg: 'flex', gap: 1 }}>
              {tools.map((tool) => (
                <Button
                  key={tool.path}
                  component={Link}
                  to={tool.path}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    color: location.pathname === tool.path ? 'primary.main' : 'text.secondary',
                    backgroundColor: location.pathname === tool.path ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    }
                  }}
                >
                  {tool.name}
                </Button>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            {import.meta.env.VITE_GITHUB_URL && (
              <IconButton
                color="inherit"
                href={import.meta.env.VITE_GITHUB_URL}
                target="_blank"
                size="small"
              >
                <GitHubIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton
              color="inherit"
              component={Link}
              to="/attribution"
              size="small"
            >
              <LicenseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main content */}
      <Box component="main" sx={{ flex: 1, pt: { xs: 6, md: 10 }, pb: 12 }}>
        <Container maxWidth="lg">
          {/* Page header (Hero Style) */}
          <Box sx={{ mb: { xs: 6, md: 10 }, textAlign: 'center' }}>
            <Typography
              variant="h1"
              className="gradient-text float-anim"
              sx={{
                mb: 2,
                fontWeight: 900,
                fontSize: { xs: '2.5rem', md: '4rem' },
                lineHeight: 1
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="h5"
              color="text.secondary"
              sx={{ maxWidth: 700, mx: 'auto', fontWeight: 500, opacity: 0.9 }}
            >
              {description}
            </Typography>
          </Box>

          {/* Privacy notice - Integrated Glass Style */}
          <Paper
            sx={{
              p: 2,
              mb: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: alpha(theme.palette.success.main, 0.05),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
              borderRadius: 4,
              boxShadow: 'none'
            }}
          >
            <SecurityIcon sx={{ color: 'success.main', fontSize: '20px' }} />
            <Typography variant="body2" color="success.main" fontWeight={700}>
              Private • Browser-Side • Zero Data Transfer
            </Typography>
          </Paper>

          {/* Tool content Area (Glass Box) */}
          <Box sx={{
            p: { xs: 0, md: 4 },
            borderRadius: 6,
            background: 'transparent'
          }}>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      {showAttribution && (
        <Box
          component="footer"
          sx={{
            py: 6,
            borderTop: '1px solid rgba(0,0,0,0.05)',
            background: alpha(theme.palette.background.paper, 0.5),
            backdropFilter: 'blur(8px)'
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 3 }}>
              <Box>
                <Typography variant="h6" fontWeight={800} color="primary.main">PDF.KIT</Typography>
                <Typography variant="caption" color="text.secondary">
                  Next-gen PDF toolkit • Pure browser power
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 3 }}>
                <Link to="/attribution" style={{ color: theme.palette.primary.main, textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
                  Licenses
                </Link>
                {import.meta.env.VITE_GITHUB_URL && (
                  <a href={import.meta.env.VITE_GITHUB_URL} target="_blank" rel="noopener noreferrer" style={{ color: theme.palette.primary.main, textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
                    Github
                  </a>
                )}
              </Box>

              <Typography variant="caption" color="text.disabled">
                Built with WebAssembly • No servers • No tracking
              </Typography>
            </Box>
          </Container>
        </Box>
      )}
    </Box>
  );
};

export default ToolLayout;