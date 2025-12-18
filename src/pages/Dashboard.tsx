/**
 * Dashboard - Main tool selection interface
 * Modern 2026 Bento Grid design
 */

import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  Chip,
  AppBar,
  Toolbar,
  IconButton,
  Paper,
  useTheme,
  alpha,
  Grid,
} from '@mui/material'
import {
  Compress as CompressIcon,
  MergeType as MergeIcon,
  CallSplit as SplitIcon,
  TextFields as OCRIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  CloudOff as OfflineIcon,
  Devices as MobileIcon,
  GitHub as GitHubIcon,
  Description as LicenseIcon,
  FolderZip as FolderZipIcon,
  Memory as MemoryIcon,
  PrivacyTip as PrivacyTipIcon
} from '@mui/icons-material'

interface ToolCardProps {
  to: string;
  title: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  color: string;
  large?: boolean;
}

const ToolCard: React.FC<ToolCardProps> = ({ to, title, description, features, icon, color, large }) => {
  const navigate = useNavigate();

  return (
    <Card
      className={large ? 'bento-item-large' : ''}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: color,
        }
      }}
      onClick={() => navigate(to)}
    >
      <CardContent sx={{ flexGrow: 1, p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              backgroundColor: alpha(color, 0.1),
              color: color,
              mr: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(icon as React.ReactElement, { fontSize: large ? 'large' : 'medium' })}
          </Box>
          <Typography variant={large ? "h4" : "h6"} component="h3" fontWeight={700}>
            {title}
          </Typography>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, flexGrow: 1 }}>
          {description}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 'auto' }}>
          {features.map((feature, index) => (
            <Chip
              key={index}
              label={feature}
              size="small"
              sx={{
                fontWeight: 600,
                backgroundColor: alpha(color, 0.05),
                color: color,
                border: `1px solid ${alpha(color, 0.2)}`,
              }}
            />
          ))}
        </Box>
      </CardContent>

      <Box sx={{ p: 4, pt: 0 }}>
        <Button
          variant="text"
          fullWidth
          sx={{
            color: color,
            justifyContent: 'flex-start',
            px: 0,
            fontWeight: 700,
            '&:hover': {
              backgroundColor: 'transparent',
              textDecoration: 'underline',
            }
          }}
        >
          Open Tool →
        </Button>
      </Box>
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const theme = useTheme();

  return (
    <Box sx={{ minHeight: '100vh', pb: 10 }}>
      {/* App Bar */}
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'primary.main' }}>
            PDF.KIT
          </Typography>
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

      <Container maxWidth="lg" sx={{ pt: 12, pb: 8 }}>
        {/* Hero Section */}
        <Box sx={{ textAlign: 'center', mb: 12 }}>
          <Typography
            variant="h1"
            component="h1"
            className="gradient-text float-anim"
            sx={{ mb: 3 }}
          >
            PDF Magic, Locally.
          </Typography>

          <Typography
            variant="h5"
            color="text.secondary"
            sx={{ mb: 6, maxWidth: 700, mx: 'auto', fontWeight: 500 }}
          >
            Privacy-first PDF engineering. No uploads, no servers, just pure browser-side performance.
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2 }}>
            {[
              { label: 'Secure', Icon: SecurityIcon, color: theme.palette.success.main },
              { label: 'Fast', Icon: SpeedIcon, color: theme.palette.primary.main },
              { label: 'Offline', Icon: OfflineIcon, color: theme.palette.info.main },
              { label: 'Mobile', Icon: MobileIcon, color: theme.palette.secondary.main },
            ].map(({ label, Icon, color }) => (
              <Chip
                key={label}
                icon={<Icon sx={{ color: `${color} !important`, fontSize: '18px' }} />}
                label={label}
                sx={{
                  py: 2.5,
                  px: 1,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  backgroundColor: alpha(color, 0.08),
                  color: color,
                  border: `1px solid ${alpha(color, 0.2)}`,
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Bento Grid Tools */}
        <Box className="bento-grid" sx={{ mb: 12 }}>
          <ToolCard
            to="/compress"
            title="Compress"
            description="Shrink your documents without losing a pixel of quality. Intelligent optimization at its finest."
            features={["Quality presets", "WebAssembly", "Fast"]}
            icon={<CompressIcon />}
            color={theme.palette.primary.main}
            large
          />

          <ToolCard
            to="/merge"
            title="Merge"
            description="Drag. Drop. Done. The simplest way to unite multiple PDFs into one."
            features={["Reorder", "Fast", "Private"]}
            icon={<MergeIcon />}
            color={theme.palette.success.main}
          />

          <ToolCard
            to="/split"
            title="Split"
            description="Extract precisely what you need. Any range, any page, in seconds."
            features={["Ranges", "Preview", "Simple"]}
            icon={<SplitIcon />}
            color={theme.palette.warning.main}
          />

          <ToolCard
            to="/ocr"
            title="OCR"
            description="Turn static scans into interactive text. Multi-language support included."
            features={["Searchable", "99% Accuracy", "Tesseract"]}
            icon={<OCRIcon />}
            color={theme.palette.secondary.main}
          />
        </Box>

        {/* Feature Showcase Section */}
        <Box sx={{ mb: 16 }}>
          <Typography
            variant="h2"
            textAlign="center"
            className="gradient-text"
            sx={{ mb: 10, fontWeight: 900, fontSize: { xs: '2.5rem', md: '3.5rem' } }}
          >
            Modern PDF Stack
          </Typography>

          <Grid container spacing={4}>
            {[
              {
                icon: <FolderZipIcon sx={{ fontSize: 40 }} />,
                title: 'Native File Access',
                desc: 'Pick your files directly. No middlemen, no uploads, just pure local speed.',
                color: theme.palette.primary.main
              },
              {
                icon: <MemoryIcon sx={{ fontSize: 40 }} />,
                title: 'Client-Side Power',
                desc: 'Processing happens in your RAM via WebAssembly. Desktop-grade performance.',
                color: theme.palette.success.main
              },
              {
                icon: <PrivacyTipIcon sx={{ fontSize: 40 }} />,
                title: 'Zero Data Leaks',
                desc: 'Your documents never leave your browser sandbox. Privacy by design.',
                color: theme.palette.secondary.main
              },
            ].map((item, i) => (
              <Grid item xs={12} md={4} key={i}>
                <Paper
                  elevation={0}
                  className="glass"
                  sx={{
                    p: 6,
                    height: '100%',
                    textAlign: 'center',
                    background: alpha(item.color, 0.03),
                    borderColor: alpha(item.color, 0.1),
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      background: alpha(item.color, 0.06),
                      boxShadow: `0 30px 60px -12px ${alpha(item.color, 0.15)}`,
                      '& .feature-icon': {
                        transform: 'scale(1.1)',
                      }
                    }
                  }}
                >
                  <Box
                    className="feature-icon float-anim"
                    sx={{
                      mb: 4,
                      color: item.color,
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: 4,
                      background: alpha(item.color, 0.1),
                      transition: 'transform 0.4s ease'
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Typography variant="h5" fontWeight={800} gutterBottom sx={{ mb: 2 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7, opacity: 0.8 }}>
                    {item.desc}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Footer/Value Props */}
        <Card sx={{ p: 6, textAlign: 'center', background: alpha(theme.palette.primary.main, 0.03) }}>
          <Typography variant="h4" fontWeight={900} gutterBottom className="gradient-text">
            Why settle for cloud conversion?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
            Experience the next generation of PDF tools. Faster, safer, and entirely yours.
          </Typography>
          <Button
            variant="contained"
            size="large"
            component={Link}
            to="/compress"
            sx={{ borderRadius: 4, py: 2, px: 6 }}
          >
            Start Processing
          </Button>
        </Card>
      </Container>
    </Box>
  )
}

export default Dashboard
