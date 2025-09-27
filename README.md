# PennyProtect 🛡️

**Next-Generation AI-Powered Retail Security System**

PennyProtect is a comprehensive retail security platform that combines advanced YOLOv11 computer vision AI with real-time monitoring to protect your business from theft, fraud, and security incidents.

![PennyProtect Dashboard](https://via.placeholder.com/800x400/1a1a1a/white?text=PennyProtect+Dashboard)

🌐 **Visit us at: [www.pennyagents.com](https://www.pennyagents.com)**

## 🚀 Features

### 🤖 **Advanced AI Detection (YOLOv11)**
- **Real-time Object Detection**: Latest YOLOv11 models for superior accuracy and speed
- **Facial Recognition**: AWS Rekognition integration with watchlist matching
- **Behavior Analysis**: Advanced pose estimation and activity recognition
- **Gait Detection**: Identify individuals by walking patterns across multiple cameras
- **Theft Prevention**: Detect concealment, suspicious movements, and shoplifting patterns

### 📹 **Camera Integration**
- **RTSP/ONVIF Support**: Connect existing IP cameras without hardware changes
- **Multi-Camera Management**: Centralized control of unlimited security cameras
- **PTZ Control**: Remote pan, tilt, zoom control for supported cameras
- **Stream Health Monitoring**: Automatic detection and alerts for camera failures

### 🚨 **Intelligent Alert System**
- **Multi-Channel Notifications**: SMS, Email, and in-app real-time alerts
- **AI Threat Assessment**: Automated severity classification and prioritization
- **Evidence Packaging**: Automatic compilation of video clips, images, and metadata
- **Incident Management**: Complete workflow from detection to resolution

### 🏢 **Enterprise Multi-Tenant Architecture**
- **Multi-Store Management**: Support for unlimited retail locations
- **Role-Based Access Control**: Granular permissions for different user types
- **Tenant Isolation**: Secure data separation between organizations
- **White-Label Solutions**: Customizable branding for resellers

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   AI Service    │
│   (Vercel)      │◄──►│   (Railway)     │◄──►│   (Modal)       │
│   React + TS    │    │   Node.js + TS  │    │  YOLOv11 + AI   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │   PostgreSQL    │    │   YOLOv11       │
         │              │   (Supabase)    │    │   OpenCV + AI   │
         │              └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Camera Network                              │
│   RTSP Streams ◄──► YOLOv11 Analysis ◄──► Alert System        │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Why YOLOv11?

**Latest Generation Computer Vision:**
- **50% faster** inference than YOLOv8
- **Higher accuracy** for small object detection
- **Better performance** on edge devices
- **Enhanced multi-object tracking**
- **Improved real-time processing**

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL database
- Camera with RTSP stream

### 1. Clone the Repository
```bash
git clone https://github.com/Felix-Penny/PennyProtect.git
cd PennyProtect
```

### 2. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install AI service dependencies (YOLOv11)
cd ai-service
pip install ultralytics==8.1.0  # Latest with YOLOv11 support
pip install -r requirements.txt
cd ..
```

### 3. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys and database URLs
# See our deployment guide at https://www.pennyagents.com/docs
```

### 4. Start Services
```bash
# Start AI service with YOLOv11
cd ai-service && python start.py &

# Start backend API
npm run dev &

# Start frontend (in another terminal)
cd client && npm run dev
```

### 5. Add Your First Camera
1. Open http://localhost:3000
2. Login with your credentials
3. Navigate to Camera Management
4. Add camera with RTSP URL: `rtsp://username:password@camera-ip:554/stream`

## 📚 Documentation

- [🔧 **Setup Guide**](https://www.pennyagents.com/docs/setup) - Detailed installation instructions
- [☁️ **Deployment Guide**](https://www.pennyagents.com/docs/deployment) - Cloud deployment with Railway, Modal, Vercel
- [📹 **Camera Integration**](https://www.pennyagents.com/docs/cameras) - RTSP/ONVIF camera configuration
- [🤖 **YOLOv11 Configuration**](https://www.pennyagents.com/docs/yolo) - AI model setup and tuning
- [🔐 **Security Guide**](https://www.pennyagents.com/docs/security) - Security best practices
- [📖 **API Documentation**](https://www.pennyagents.com/api) - Complete API reference

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: JWT + bcrypt
- **Real-time**: Socket.io WebSockets

### AI Service (YOLOv11)
- **Framework**: FastAPI + Python
- **Computer Vision**: YOLOv11 (Ultralytics), OpenCV
- **Deep Learning**: PyTorch, ONNX Runtime
- **Cloud AI**: OpenAI GPT-4 Vision, AWS Rekognition

### Frontend
- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **UI Components**: Shadcn/ui

### Infrastructure
- **Hosting**: Railway (API), Modal (AI), Vercel (Frontend)
- **Database**: Supabase PostgreSQL
- **Storage**: AWS S3
- **Monitoring**: Winston Logging

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Fork the repository
git fork https://github.com/Felix-Penny/PennyProtect.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and commit
git commit -m 'Add amazing feature'

# Push to your fork and create PR
git push origin feature/amazing-feature
```

## 🏢 Commercial Solutions

**Enterprise deployments available through [PennyAgents.com](https://www.pennyagents.com)**

### 🎯 Enterprise Features
- **Custom YOLOv11 Models**: Trained on your specific retail environment
- **24/7 Monitoring Center**: Professional security monitoring services
- **Advanced Analytics**: Business intelligence and loss prevention insights
- **Integration APIs**: Connect with POS, access control, and other systems
- **Compliance Tools**: GDPR, privacy, and regulatory compliance features

### 📞 Contact Sales
- 🌐 **Website**: [www.pennyagents.com](https://www.pennyagents.com)
- 📧 **Sales**: sales@pennyagents.com
- 📞 **Phone**: +1 (555) 123-PENNY
- 💬 **Live Chat**: Available on our website

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 🌐 **Documentation**: [www.pennyagents.com/docs](https://www.pennyagents.com/docs)
- 📧 **Email**: support@pennyagents.com
- 💬 **Community**: [GitHub Discussions](https://github.com/Felix-Penny/PennyProtect/discussions)
- 🐛 **Issues**: [GitHub Issues](https://github.com/Felix-Penny/PennyProtect/issues)

## 🏆 Roadmap

- [ ] **YOLOv11 Custom Training**: Retail-specific model fine-tuning
- [ ] **Mobile App**: iOS/Android companion app
- [ ] **Advanced Analytics**: Predictive loss prevention
- [ ] **Integration Marketplace**: POS, access control, ERP systems
- [ ] **Edge Deployment**: On-premise AI processing
- [ ] **Global Expansion**: Multi-language and region support

---

**Built with ❤️ by the PennyAgents team**

*Next-generation retail security powered by YOLOv11*

🌐 [www.pennyagents.com](https://www.pennyagents.com) | 📧 hello@pennyagents.com