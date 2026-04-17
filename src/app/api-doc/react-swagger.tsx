"use client";

import SwaggerUI from "swagger-ui-react";

interface ReactSwaggerProps {
  spec: Record<string, any>;
}

export default function ReactSwagger({ spec }: ReactSwaggerProps) {
  return (
    <>
      <style jsx global>{`
        /* ================================
           DARK THEME - Match App Style
           ================================ */
        .swagger-ui {
          font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif !important;
          color: #f8fafc !important;
          background: #0f172a !important;
          line-height: 1.6 !important;
        }

        /* Hide topbar */
        .swagger-ui .topbar {
          display: none !important;
        }

        /* ================================
           INFO SECTION
           ================================ */
        .swagger-ui .info {
          margin: 0 0 32px 0 !important;
          padding: 24px !important;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%) !important;
          border: 1px solid rgba(99, 102, 241, 0.2) !important;
          border-radius: 16px !important;
          backdrop-filter: blur(10px) !important;
        }

        .swagger-ui .info .title {
          font-size: 32px !important;
          font-weight: 800 !important;
          background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
          margin: 0 0 16px 0 !important;
          letter-spacing: -0.02em !important;
        }

        .swagger-ui .info .description {
          font-size: 15px !important;
          color: #94a3b8 !important;
          line-height: 1.7 !important;
        }

        .swagger-ui .info a {
          color: #818cf8 !important;
          font-weight: 600 !important;
          transition: all 0.2s !important;
        }

        .swagger-ui .info a:hover {
          color: #c084fc !important;
          text-decoration: none !important;
        }

        .swagger-ui .info .version {
          background: rgba(99, 102, 241, 0.2) !important;
          color: #818cf8 !important;
          padding: 4px 12px !important;
          border-radius: 9999px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          margin-left: 12px !important;
          border: 1px solid rgba(99, 102, 241, 0.3) !important;
        }

        /* ================================
           TAG HEADERS
           ================================ */
        .swagger-ui .opblock-tag {
          font-size: 20px !important;
          font-weight: 700 !important;
          color: #f8fafc !important;
          border-bottom: 1px solid rgba(99, 102, 241, 0.2) !important;
          padding: 24px 0 12px 0 !important;
          margin: 32px 0 16px 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
        }

        .swagger-ui .opblock-tag small {
          color: #64748b !important;
          font-size: 13px !important;
          font-weight: 500 !important;
        }

        .swagger-ui .opblock-tag svg {
          fill: #818cf8 !important;
          width: 22px !important;
          height: 22px !important;
        }

        /* ================================
           API ENDPOINT CARDS
           ================================ */
        .swagger-ui .opblock {
          border-radius: 16px !important;
          margin: 12px 0 !important;
          border: 1px solid rgba(99, 102, 241, 0.15) !important;
          background: rgba(30, 41, 59, 0.6) !important;
          backdrop-filter: blur(10px) !important;
          overflow: hidden !important;
          transition: all 0.3s ease !important;
        }

        .swagger-ui .opblock:hover {
          border-color: rgba(99, 102, 241, 0.3) !important;
          box-shadow: 0 8px 32px rgba(99, 102, 241, 0.15) !important;
          transform: translateY(-2px) !important;
        }

        .swagger-ui .opblock .opblock-summary {
          padding: 16px 20px !important;
          background: rgba(15, 23, 42, 0.5) !important;
          border-bottom: 1px solid rgba(99, 102, 241, 0.1) !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
        }

        /* HTTP Method Badges */
        .swagger-ui .opblock .opblock-summary-method {
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 12px !important;
          padding: 6px 12px !important;
          min-width: 70px !important;
          text-align: center !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        }

        /* GET - Indigo gradient */
        .swagger-ui .opblock.opblock-get {
          border-color: rgba(99, 102, 241, 0.25) !important;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(30, 41, 59, 0.4) 100%) !important;
        }
        .swagger-ui .opblock.opblock-get .opblock-summary-method {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
          color: white !important;
        }

        /* POST - Purple gradient */
        .swagger-ui .opblock.opblock-post {
          border-color: rgba(139, 92, 246, 0.25) !important;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(30, 41, 59, 0.4) 100%) !important;
        }
        .swagger-ui .opblock.opblock-post .opblock-summary-method {
          background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%) !important;
          color: white !important;
        }

        /* PUT - Amber */
        .swagger-ui .opblock.opblock-put {
          border-color: rgba(245, 158, 11, 0.25) !important;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(30, 41, 59, 0.4) 100%) !important;
        }
        .swagger-ui .opblock.opblock-put .opblock-summary-method {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
          color: white !important;
        }

        /* DELETE - Rose */
        .swagger-ui .opblock.opblock-delete {
          border-color: rgba(244, 63, 94, 0.25) !important;
          background: linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(30, 41, 59, 0.4) 100%) !important;
        }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method {
          background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%) !important;
          color: white !important;
        }

        /* PATCH - Cyan */
        .swagger-ui .opblock.opblock-patch {
          border-color: rgba(6, 182, 212, 0.25) !important;
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(30, 41, 59, 0.4) 100%) !important;
        }
        .swagger-ui .opblock.opblock-patch .opblock-summary-method {
          background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%) !important;
          color: white !important;
        }

        .swagger-ui .opblock .opblock-summary-path {
          font-size: 15px !important;
          font-weight: 600 !important;
          color: #f8fafc !important;
          font-family: 'Monaco', 'Menlo', monospace !important;
          letter-spacing: -0.02em !important;
        }

        .swagger-ui .opblock .opblock-summary-description {
          color: #94a3b8 !important;
          font-size: 13px !important;
          margin-left: auto !important;
        }

        /* Arrow icon */
        .swagger-ui .opblock .opblock-summary-control svg {
          fill: #64748b !important;
          transition: all 0.2s !important;
        }

        .swagger-ui .opblock .opblock-summary-control:hover svg {
          fill: #818cf8 !important;
        }

        /* ================================
           EXPANDED CONTENT
           ================================ */
        .swagger-ui .opblock-body {
          background: rgba(15, 23, 42, 0.8) !important;
          padding: 24px !important;
          border-top: 1px solid rgba(99, 102, 241, 0.1) !important;
        }

        .swagger-ui .opblock-section-header {
          background: rgba(30, 41, 59, 0.6) !important;
          padding: 16px 24px !important;
          margin: -24px -24px 24px -24px !important;
          border-bottom: 1px solid rgba(99, 102, 241, 0.1) !important;
        }

        .swagger-ui .opblock-section-header h4 {
          font-size: 14px !important;
          font-weight: 700 !important;
          color: #e2e8f0 !important;
          margin: 0 !important;
        }

        /* ================================
           PARAMETERS TABLE
           ================================ */
        .swagger-ui .parameters-container {
          background: rgba(30, 41, 59, 0.4) !important;
          border: 1px solid rgba(99, 102, 241, 0.15) !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          margin: 20px 0 !important;
        }

        .swagger-ui table {
          width: 100% !important;
          border-collapse: collapse !important;
        }

        .swagger-ui table thead {
          background: rgba(99, 102, 241, 0.1) !important;
        }

        .swagger-ui table thead th {
          text-align: left !important;
          padding: 12px 16px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #818cf8 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          border-bottom: 1px solid rgba(99, 102, 241, 0.2) !important;
        }

        .swagger-ui table tbody td {
          padding: 16px !important;
          font-size: 14px !important;
          color: #e2e8f0 !important;
          border-bottom: 1px solid rgba(99, 102, 241, 0.1) !important;
        }

        .swagger-ui table tbody tr:last-child td {
          border-bottom: none !important;
        }

        .swagger-ui .parameter__name {
          font-weight: 700 !important;
          color: #f8fafc !important;
          font-size: 14px !important;
          font-family: monospace !important;
        }

        .swagger-ui .parameter__name.required::after {
          content: " *" !important;
          color: #f43f5e !important;
        }

        .swagger-ui .parameter__type {
          background: rgba(99, 102, 241, 0.15) !important;
          color: #818cf8 !important;
          padding: 2px 8px !important;
          border-radius: 4px !important;
          font-size: 12px !important;
          font-family: monospace !important;
          margin-left: 8px !important;
          border: 1px solid rgba(99, 102, 241, 0.2) !important;
        }

        .swagger-ui .parameter__in {
          color: #64748b !important;
          font-size: 12px !important;
          font-style: italic !important;
        }

        .swagger-ui .parameter__description {
          color: #94a3b8 !important;
          font-size: 13px !important;
          margin-top: 4px !important;
          line-height: 1.5 !important;
        }

        /* ================================
           INPUT FIELDS
           ================================ */
        .swagger-ui input[type="text"],
        .swagger-ui input[type="email"],
        .swagger-ui input[type="password"],
        .swagger-ui textarea,
        .swagger-ui select {
          background: rgba(15, 23, 42, 0.8) !important;
          border: 1px solid rgba(99, 102, 241, 0.2) !important;
          border-radius: 10px !important;
          padding: 10px 14px !important;
          font-size: 14px !important;
          color: #f8fafc !important;
          transition: all 0.2s !important;
        }

        .swagger-ui input:focus,
        .swagger-ui textarea:focus,
        .swagger-ui select:focus {
          outline: none !important;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
        }

        .swagger-ui input::placeholder {
          color: #64748b !important;
        }

        /* ================================
           BUTTONS
           ================================ */
        .swagger-ui .btn {
          border-radius: 10px !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          padding: 10px 20px !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
          border: none !important;
        }

        .swagger-ui .btn:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        }

        .swagger-ui .btn.try-out__btn {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
          color: white !important;
        }

        .swagger-ui .btn.try-out__btn:hover {
          background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%) !important;
        }

        .swagger-ui .btn.execute {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          color: white !important;
        }

        .swagger-ui .btn.execute:hover {
          background: linear-gradient(135deg, #34d399 0%, #10b981 100%) !important;
        }

        .swagger-ui .btn.cancel {
          background: rgba(99, 102, 241, 0.1) !important;
          color: #818cf8 !important;
          border: 1px solid rgba(99, 102, 241, 0.2) !important;
        }

        .swagger-ui .btn.cancel:hover {
          background: rgba(99, 102, 241, 0.2) !important;
        }

        /* ================================
           RESPONSES
           ================================ */
        .swagger-ui .responses-wrapper {
          background: rgba(30, 41, 59, 0.4) !important;
          border: 1px solid rgba(99, 102, 241, 0.15) !important;
          border-radius: 12px !important;
          margin-top: 24px !important;
          overflow: hidden !important;
        }

        .swagger-ui .responses-inner h4 {
          background: rgba(99, 102, 241, 0.1) !important;
          padding: 16px 20px !important;
          margin: 0 !important;
          font-size: 14px !important;
          font-weight: 700 !important;
          color: #e2e8f0 !important;
          border-bottom: 1px solid rgba(99, 102, 241, 0.15) !important;
        }

        .swagger-ui .response-col_status {
          font-family: monospace !important;
          font-weight: 700 !important;
          font-size: 14px !important;
          padding: 12px 16px !important;
        }

        .swagger-ui .response-col_status__200,
        .swagger-ui .response-col_status__201 {
          color: #34d399 !important;
          background: rgba(16, 185, 129, 0.1) !important;
        }

        .swagger-ui .response-col_status__400,
        .swagger-ui .response-col_status__401,
        .swagger-ui .response-col_status__404 {
          color: #fbbf24 !important;
          background: rgba(245, 158, 11, 0.1) !important;
        }

        .swagger-ui .response-col_status__500 {
          color: #fb7185 !important;
          background: rgba(244, 63, 94, 0.1) !important;
        }

        .swagger-ui .response-col_description {
          color: #94a3b8 !important;
          font-size: 14px !important;
          padding: 12px 16px !important;
        }

        /* ================================
           CODE BLOCKS
           ================================ */
        .swagger-ui .microlight,
        .swagger-ui .curl-command,
        .swagger-ui .request-url pre {
          background: #020617 !important;
          color: #e2e8f0 !important;
          border-radius: 12px !important;
          padding: 20px !important;
          font-family: 'Monaco', 'Menlo', monospace !important;
          font-size: 13px !important;
          line-height: 1.6 !important;
          border: 1px solid rgba(99, 102, 241, 0.2) !important;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3) !important;
        }

        /* ================================
           MODELS
           ================================ */
        .swagger-ui .model-box {
          background: rgba(30, 41, 59, 0.4) !important;
          border: 1px solid rgba(99, 102, 241, 0.15) !important;
          border-radius: 12px !important;
          padding: 24px !important;
        }

        .swagger-ui .model-title {
          color: #f8fafc !important;
          font-weight: 700 !important;
          font-size: 16px !important;
          margin-bottom: 16px !important;
        }

        .swagger-ui .model-property-name {
          color: #818cf8 !important;
          font-weight: 600 !important;
          font-family: monospace !important;
        }

        /* ================================
           TABS
           ================================ */
        .swagger-ui .tab {
          padding: 12px 20px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          color: #64748b !important;
          border-bottom: 2px solid transparent !important;
          transition: all 0.2s !important;
        }

        .swagger-ui .tab:hover {
          color: #818cf8 !important;
        }

        .swagger-ui .tab.active {
          color: #818cf8 !important;
          border-bottom-color: #6366f1 !important;
          font-weight: 700 !important;
        }

        /* ================================
           FILTER
           ================================ */
        .swagger-ui .filter .filter-input {
          width: 100% !important;
          background: rgba(15, 23, 42, 0.8) !important;
          border: 1px solid rgba(99, 102, 241, 0.2) !important;
          border-radius: 12px !important;
          padding: 14px 20px !important;
          font-size: 16px !important;
          color: #f8fafc !important;
          margin-bottom: 24px !important;
        }

        .swagger-ui .filter .filter-input:focus {
          outline: none !important;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
        }

        .swagger-ui .filter .filter-input::placeholder {
          color: #64748b !important;
        }

        /* ================================
           MARKDOWN
           ================================ */
        .swagger-ui .markdown p {
          color: #94a3b8 !important;
          font-size: 14px !important;
          line-height: 1.7 !important;
          margin-bottom: 12px !important;
        }

        .swagger-ui .markdown a {
          color: #818cf8 !important;
          font-weight: 600 !important;
          transition: all 0.2s !important;
        }

        .swagger-ui .markdown a:hover {
          color: #c084fc !important;
          text-decoration: none !important;
        }

        .swagger-ui .markdown code {
          background: rgba(99, 102, 241, 0.15) !important;
          color: #818cf8 !important;
          padding: 3px 8px !important;
          border-radius: 4px !important;
          font-family: monospace !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          border: 1px solid rgba(99, 102, 241, 0.2) !important;
        }

        /* ================================
           AUTHORIZATION
           ================================ */
        .swagger-ui .auth-wrapper .authorize {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
          color: white !important;
          border-radius: 10px !important;
          padding: 10px 20px !important;
          font-weight: 600 !important;
          border: none !important;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3) !important;
        }

        .swagger-ui .auth-wrapper .authorize:hover {
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4) !important;
          transform: translateY(-1px) !important;
        }

        /* ================================
           SCHEMES
           ================================ */
        .swagger-ui .schemes-container,
        .swagger-ui .servers {
          background: rgba(30, 41, 59, 0.4) !important;
          border: 1px solid rgba(99, 102, 241, 0.15) !important;
          border-radius: 12px !important;
          padding: 20px !important;
          margin: 16px 0 !important;
        }

        .swagger-ui .schemes-title {
          font-size: 14px !important;
          font-weight: 700 !important;
          color: #e2e8f0 !important;
          margin-bottom: 12px !important;
        }

        .swagger-ui .servers select {
          width: 100% !important;
          background: rgba(15, 23, 42, 0.8) !important;
          border: 1px solid rgba(99, 102, 241, 0.2) !important;
          border-radius: 10px !important;
          padding: 10px 14px !important;
          font-size: 14px !important;
          color: #f8fafc !important;
        }
      `}</style>

      <SwaggerUI
        spec={spec}
        docExpansion="list"
        defaultModelsExpandDepth={3}
        displayRequestDuration={true}
        filter={true}
      />
    </>
  );
}
