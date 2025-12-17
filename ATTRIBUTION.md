# PDF Toolkit - Third-Party Attributions

This document provides detailed attribution information for all third-party libraries and components used in the PDF Toolkit project.

---

## Core Dependencies

### Ghostscript
- **Purpose**: PDF compression and optimization
- **License**: GNU Affero General Public License v3 (AGPL v3)
- **Copyright**: Copyright (C) 2001-2023 Artifex Software, Inc.
- **Website**: https://www.ghostscript.com/
- **License URL**: https://www.gnu.org/licenses/agpl-3.0.html
- **Commercial Licensing**: Available from Artifex Software (https://www.artifex.com/)

### Tesseract OCR
- **Purpose**: Optical character recognition for scanned PDFs
- **License**: Apache License 2.0
- **Copyright**: Copyright (c) 2006 Google Inc.
- **Website**: https://github.com/tesseract-ocr/tesseract
- **License URL**: https://www.apache.org/licenses/LICENSE-2.0

### PDF-lib
- **Purpose**: PDF manipulation (merge, split, creation)
- **License**: MIT License
- **Copyright**: Copyright (c) 2019 Andrew Dillon
- **Website**: https://github.com/Hopding/pdf-lib
- **License URL**: https://opensource.org/licenses/MIT

---

## Frontend Framework

### React
- **Purpose**: User interface framework
- **License**: MIT License
- **Copyright**: Copyright (c) Facebook, Inc. and its affiliates
- **Website**: https://reactjs.org/
- **License URL**: https://opensource.org/licenses/MIT

### React Router
- **Purpose**: Client-side routing
- **License**: MIT License
- **Copyright**: Copyright (c) React Training 2016-2018, Copyright (c) Remix Software 2020-2021
- **Website**: https://reactrouter.com/
- **License URL**: https://opensource.org/licenses/MIT

---

## Development Tools

### TypeScript
- **Purpose**: Type system for JavaScript
- **License**: Apache License 2.0
- **Copyright**: Copyright (c) Microsoft Corporation
- **Website**: https://www.typescriptlang.org/
- **License URL**: https://www.apache.org/licenses/LICENSE-2.0

### Vite
- **Purpose**: Build tool and development server
- **License**: MIT License
- **Copyright**: Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors
- **Website**: https://vitejs.dev/
- **License URL**: https://opensource.org/licenses/MIT

### ESLint
- **Purpose**: JavaScript/TypeScript linting
- **License**: MIT License
- **Copyright**: Copyright JS Foundation and other contributors
- **Website**: https://eslint.org/
- **License URL**: https://opensource.org/licenses/MIT

---

## WebAssembly Components

### Emscripten
- **Purpose**: Compile C/C++ to WebAssembly
- **License**: MIT License and University of Illinois/NCSA Open Source License
- **Copyright**: Copyright (c) 2010-2014 Emscripten authors
- **Website**: https://emscripten.org/
- **License URL**: https://github.com/emscripten-core/emscripten/blob/main/LICENSE

---

## Testing Framework

### Vitest
- **Purpose**: Unit testing framework
- **License**: MIT License
- **Copyright**: Copyright (c) 2021-Present Anthony Fu, Matias Capeletto
- **Website**: https://vitest.dev/
- **License URL**: https://opensource.org/licenses/MIT

### fast-check
- **Purpose**: Property-based testing library
- **License**: MIT License
- **Copyright**: Copyright (c) 2017-present Nicolas DUBIEN
- **Website**: https://github.com/dubzzz/fast-check
- **License URL**: https://opensource.org/licenses/MIT

---

## Additional Acknowledgments

### Browser APIs
This project makes extensive use of modern browser APIs:
- **Web Workers**: For background processing
- **WebAssembly**: For high-performance PDF processing
- **File API**: For client-side file handling
- **Blob API**: For file downloads
- **Canvas API**: For PDF rendering and OCR preprocessing

### Standards and Specifications
- **PDF Specification**: ISO 32000-1:2008 and ISO 32000-2:2017
- **WebAssembly Specification**: W3C WebAssembly Working Group
- **ECMAScript**: ECMA-262 specification

---

## License Compatibility Matrix

| Component | License | Compatible with MIT | Commercial Use | Source Disclosure Required |
|-----------|---------|-------------------|----------------|---------------------------|
| Main Project | MIT | ✅ | ✅ | ❌ |
| Ghostscript | AGPL v3 | ⚠️ | ⚠️ | ✅ |
| Tesseract | Apache 2.0 | ✅ | ✅ | ❌ |
| PDF-lib | MIT | ✅ | ✅ | ❌ |
| React | MIT | ✅ | ✅ | ❌ |
| TypeScript | Apache 2.0 | ✅ | ✅ | ❌ |
| Vite | MIT | ✅ | ✅ | ❌ |

**Legend:**
- ✅ = Fully compatible/allowed
- ⚠️ = Requires attention (see Ghostscript licensing notes)
- ❌ = Not required

---

## Compliance Notes

### AGPL v3 Compliance (Ghostscript)
If you distribute this software or run it as a network service:
1. You must provide source code access
2. You must license derivative works under AGPL v3
3. You must include copyright and license notices
4. You must document any modifications

### Apache 2.0 Compliance (Tesseract, TypeScript)
1. Include copyright and license notices
2. Document any modifications
3. Include NOTICE file if provided by original authors

### MIT License Compliance (Most components)
1. Include copyright and license notices in distributions
2. No additional requirements for modifications or commercial use

---

## How to Attribute

When redistributing or modifying this software, include:

1. **This ATTRIBUTION.md file** in your distribution
2. **The LICENSE.md file** with all license texts
3. **Copyright notices** in source code headers where applicable
4. **Modified file notices** if you make changes to third-party components

### Example Attribution in Documentation:
```
This software uses the following open source libraries:
- Ghostscript (AGPL v3) for PDF compression
- Tesseract OCR (Apache 2.0) for text recognition
- PDF-lib (MIT) for PDF manipulation
- React (MIT) for the user interface

Full license information available in LICENSE.md
```

---

## Updates and Maintenance

This attribution file is maintained alongside the project dependencies. 
When adding new dependencies:

1. Update this ATTRIBUTION.md file
2. Update the LICENSE.md file if new license types are introduced
3. Update the Attribution page in the application UI
4. Verify license compatibility with existing components

---

## Contact

For questions about attributions or licensing:
- Open an issue on the project repository
- Review the LICENSE.md file for detailed license information
- Consult legal counsel for complex commercial use cases

Last updated: December 2024