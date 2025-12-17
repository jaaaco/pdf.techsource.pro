/**
 * ToolLayout Component - Shared layout for all tool pages
 * Validates: Requirements 8.1, 9.4
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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

  const tools = [
    { path: '/compress', name: 'Compress', icon: '🗜️' },
    { path: '/merge', name: 'Merge', icon: '📑' },
    { path: '/split', name: 'Split', icon: '✂️' },
    { path: '/ocr', name: 'OCR', icon: '🔍' }
  ];

  return (
    <div className={`tool-layout ${className}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: '#ffffff', 
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 0'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Logo and title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link 
              to="/" 
              style={{ 
                textDecoration: 'none', 
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <div style={{ fontSize: '1.5rem' }}>📄</div>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
                PDF Toolkit
              </h1>
            </Link>
            
            {toolName && (
              <>
                <span style={{ color: '#d1d5db' }}>•</span>
                <span style={{ color: '#6b7280', fontSize: '1rem' }}>{toolName}</span>
              </>
            )}
          </div>

          {/* Navigation */}
          {showNavigation && (
            <nav style={{ display: 'flex', gap: '0.5rem' }}>
              {tools.map((tool) => (
                <Link
                  key={tool.path}
                  to={tool.path}
                  style={{
                    textDecoration: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    backgroundColor: location.pathname === tool.path ? '#eff6ff' : 'transparent',
                    color: location.pathname === tool.path ? '#2563eb' : '#6b7280',
                    border: location.pathname === tool.path ? '1px solid #bfdbfe' : '1px solid transparent',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseOver={(e) => {
                    if (location.pathname !== tool.path) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.color = '#374151';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (location.pathname !== tool.path) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#6b7280';
                    }
                  }}
                >
                  <span>{tool.icon}</span>
                  {tool.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
          {/* Page header */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h1 style={{ 
              margin: '0 0 0.5rem 0', 
              fontSize: '2.5rem', 
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              {title}
            </h1>
            <p style={{ 
              margin: 0, 
              fontSize: '1.125rem', 
              color: '#6b7280',
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              {description}
            </p>
          </div>

          {/* Privacy notice */}
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <div style={{ fontSize: '1.25rem' }}>🔒</div>
            <div style={{ fontSize: '0.875rem', color: '#0c4a6e' }}>
              <strong>Privacy First:</strong> All processing happens entirely in your browser. 
              Your files never leave your device and no data is sent to any server.
            </div>
          </div>

          {/* Tool content */}
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      {/* Footer */}
      {showAttribution && (
        <footer style={{ 
          backgroundColor: '#f9fafb', 
          borderTop: '1px solid #e5e7eb',
          padding: '2rem 0'
        }}>
          <div style={{ 
            maxWidth: '1200px', 
            margin: '0 auto', 
            padding: '0 1rem',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 'bold', color: '#374151' }}>
                PDF Toolkit
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                Open-source, privacy-first PDF tools that run entirely in your browser
              </p>
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '2rem',
              flexWrap: 'wrap',
              marginBottom: '1rem'
            }}>
              <Link 
                to="/attribution" 
                style={{ 
                  color: '#3b82f6', 
                  textDecoration: 'none', 
                  fontSize: '0.875rem' 
                }}
              >
                Attribution & Licenses
              </Link>
              {import.meta.env.VITE_GITHUB_URL && (
                <>
                  <a
                    href={import.meta.env.VITE_GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#3b82f6',
                      textDecoration: 'none',
                      fontSize: '0.875rem'
                    }}
                  >
                    Source Code
                  </a>
                  <a
                    href={`${import.meta.env.VITE_GITHUB_URL}/issues`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#3b82f6',
                      textDecoration: 'none',
                      fontSize: '0.875rem'
                    }}
                  >
                    Report Issues
                  </a>
                </>
              )}
            </div>

            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              <p style={{ margin: 0 }}>
                Built with ❤️ using WebAssembly • No servers, no tracking, no data collection
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default ToolLayout;