# 🐾 PetVerse — Animal Adoption Platform

A full-stack, local-first web application designed to connect pets with loving homes and handle donations. Built natively without heavy frontend frameworks to maximize performance and portability.

## Features
- **Dynamic Post Creation**: Create adoption posts with dynamic animal categorization, or standard Buy/Sell offerings (e.g. Pet Toys, Medicine).
- **Donation Management**: Admin-configured campaigns showing live progress bars and transaction tracking.
- **Admin Dashboard**: Live statistic monitoring and moderation interface for all active posts.
- **Pure Frontend Architecture**: Glassmorphism CSS design system built purely out-of-the-box leveraging vanilla JS for maximal responsiveness without heavy dependencies.

## Setup Instructions

### 1. Prerequisites 
- **Node.js** (version 18+ recommended)
- **XAMPP / MySQL** (MariaDB) instance running locally.

### 2. Environment Variables
Create a file named `.env` in the root folder (where `package.json` is). Add the following contents, replacing values to match your specific database setup if necessary (by default, XAMPP uses no password for the `root` account):

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=animal_adoption
JWT_SECRET=super_secret_key
PORT=3000
```

### 3. Database Initialization & Seeding
Start your **MySQL** server (e.g. from the XAMPP Control Panel).
You must first load the baseline schema structure:
1. Open terminal/cmd
2. Connect to mysql and run the schema file:
   `mysql -u root < backend/schema.sql` *(Adjust path to `mysql.exe` if not global)*
3. Install dependencies:
   `npm install`
4. Populate the database with test data:
   `npm run seed`

### 4. Running the App
Once seeded, start the development server:
`npm start`

The application will be served at **[http://localhost:3000](http://localhost:3000)**. 

### Demo Credentials:
- **Admin User**: `admin@adopt.com` / `admin123`
- **Standard User**: `sara@example.com` / `user123`
