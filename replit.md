# Overview

PENNY is a comprehensive security and theft prevention system for retail stores. The application provides real-time surveillance monitoring, offender detection, alert management, and network intelligence sharing across multiple store locations. It features live camera feeds, automated threat detection, incident tracking, and analytics to help prevent theft and improve store security.

The system is built as a full-stack web application with real-time capabilities, designed to scale across multiple retail locations with centralized monitoring and distributed intelligence sharing.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite for build tooling
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme variables and responsive design
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: WebSocket integration for live updates and notifications

## Backend Architecture
- **Runtime**: Node.js with Express.js RESTful API server
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Real-time**: WebSocket server for push notifications and live data updates
- **Development**: Hot module replacement and live reloading via Vite middleware

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle Kit for migrations and schema changes
- **Connection**: Connection pooling with @neondatabase/serverless
- **Data Validation**: Zod schemas shared between client and server

## Authentication and Authorization
- Session-based authentication with PostgreSQL session storage using connect-pg-simple
- User roles and permissions system for different access levels
- Store-based access control for multi-tenant security

## Core Features and Components
- **Live Camera Monitoring**: Real-time video feed management with status tracking
- **Alert System**: Multi-severity threat detection with automated notifications
- **Offender Database**: Centralized database of known security threats with search capabilities
- **Incident Management**: Comprehensive tracking and resolution workflow for security events
- **Analytics Dashboard**: Performance metrics, prevention rates, and trend analysis
- **Network Intelligence**: Cross-store information sharing and threat correlation

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle ORM**: Type-safe database toolkit with PostgreSQL dialect

## UI and Styling
- **Radix UI**: Headless component primitives for accessibility and customization
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide React**: Comprehensive icon library for consistent visual language

## Development and Build Tools
- **Vite**: Fast build tool with hot module replacement and optimized bundling
- **TypeScript**: Type safety across the entire application stack
- **ESBuild**: High-performance JavaScript bundler for production builds

## Real-time Communication
- **WebSocket API**: Native WebSocket support for real-time alerts and updates
- **TanStack Query**: Intelligent caching and synchronization for API data

## Form Management and Validation
- **React Hook Form**: Performant form handling with minimal re-renders
- **Zod**: Runtime type validation shared between client and server
- **Hookform Resolvers**: Integration bridge for form validation schemas

## Additional Libraries
- **Class Variance Authority**: Type-safe variant generation for component styling
- **Date-fns**: Comprehensive date manipulation and formatting utilities
- **Wouter**: Lightweight routing solution for single-page applications