// Keep the original comment when rewriting the code:

require('dotenv').config();
const path = require('path');
const cors = require('cors');
const express = require('express');
const db = require('./config/db');
const bcrypt = require('bcryptjs');
// const session = require('express-session');
const bodyParser = require('body-parser');
const geoip = require('geoip-lite');
const moment = require('moment')
const multer = require('multer')
const authRoutes = require('./routes/auth');
const admin = require('./routes/admin');
const adminPurchases = require('./routes/adminPurchases');
const adminWithdraws = require('./routes/adminWithdraws');
const userRoutes = require('./routes/user');
const adminUsers = require('./routes/adminUsers');
const adminReports = require('./routes/adminReports');
// const logs = require('./routes/');
const transactionRoutes = require('./routes/transactions');
const userSubscriptionRoute = require('./routes/user_subscriptions');
const publicSubscriptionRoute = require('./routes/public_subscriptions');
const wallet = require('./routes/wallet');
const searchForUsers = require('./routes/searchForUsers');
const messageRoutes = require('./routes/messages');
const paymentRoutes = require('./routes/paymentRoutes');
const content = require('./routes/content');
const publicContent = require('./routes/public_content');
const userContent = require('./routes/user_content');
const unlock = require('./routes/unlock');
const subscrybe = require('./routes/subscrybe');
const notifications = require('./routes/notifications');
const crypto = require('./routes/crypto');
const coinbase = require('./routes/coinbase');
const cashapp = require('./routes/cashapp');
const uploadImage = require('./routes/uploadImage');
const { v2: cloudinary } = require('cloudinary');
const adServer = require('./routes/adServer'); // Import the ad server routes
const fileUpload = require('./routes/fileUpload');


const app = express();

// CORS configuration
// const corsOptions = {
//   origin: 'http://localhost:3000', // Replace with your frontend URL
//   credentials: true,
//   optionsSuccessStatus: 200
// };

// const { Storage } = require("@google-cloud/storage");
// const storage = new Storage({
//   projectId: "servers4sqldb",
//   keyFilename: "service-account.json",
// });

// Function to upload file to Firebase Storage
// service-account.json content below - make sure to keep it secure and not expose it publicly
// {
//   "type": "service_account",
//   "project_id": "servers4sqldb",
//   "private_key_id": "2ff49d7f0f81fb5061cf477be6b8cb3ccb7d2003",
//   "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCuJ6d4v6N9H/lx\nF7u6k/4b4mACOZzB6Dycy4V7IQtCqJ6Y93BeQw/qPMEwFq6YBAL0SPb22nAouy2j\nxEjmzmm49STT8U3u0bpTLSZyJu/L58IsYqw8pfhpAX+k8lRahU1rFoz5+WTMRFtG\n6jqsA/xVcepRQpO2yRUwjp4KKHsbPVJ4kbqtcsQZOLVMKciK4iuhsEMnYrNyzX2e\nrKXr/tABMyDW2ludjEvOI7ARMOqmBMNKEJcFiDJccE191Kv6MAw4X7YzGwmOzLgn\nybob/Bs5RaA1CCcrTKczqqGS++09rc+8eCPbX7nk81KcRoJKfyjeRlh+M5i3ejw6\nq50wFCkjAgMBAAECggEAC0xyTotW/tVWDb1wRf9iTd/RbRjcxS3Hz5UFUMLeOVG5\nkbYCmchNs4YuiGv9oXTSgOkXm1X6TyzZngAsNKExSw5zIwxK4JLFvQNhtP02syq9\ni7tOblQxj2pz+WO+ukK0uPJfwhCpNqFmr0KfUi1OBSMcrxnxKGYs/uykbzHyJAb/\n4L76nA0eDyvFpZmdwJLZ4YoTEAH3zi36T3Is/ZVP7G7liBr0evyqo02TGiqC3/2T\n4xo3HmavVsfexOCa+j/bv+tJRWUMMhJpCs88j3ze7yibSxwvws0EJmacCDV+Mg4Z\n/4Q1frXm/9MZuNEKe1Wuygxwr9by3OgyTucalRj+2QKBgQDZxfRe3TI0vyjsNCW2\nOkQPRyzMM1RwM8ycJOGnExJ31sgZ8dTnmsqymiEBlFOJG3UfXc78lOB5GKSk3EMf\n1N4jkLmV+/ZRHDJ2S0Gz+2YbGPhWUSMFrjSUJVSgBR5jSw2sz8sbR5wbU74Rj/Kf\nPHaNAoM3Z1qZACWTicdVFLdfmwKBgQDMuaCtyWJ7NFc0aiK3ibW8UPaHULdNM61U\ntgDL3VSTjCN69T+eyG9GVj8q5VTGDPJ9x4rf70bz7ku1/iNNiW2GXdSEBYMDTPxF\na66qg+zoRX+vzS/y23crARWWDSLn3xRq4KlmcskgPpMjP+GSVOZuvNnaqFho4WIi\nBE6Xl1QpGQKBgBOU9j1VfH87tS1QHxf8s0QAbWnLL8uLDNn5gwTn9SArgwC6Ox+8\nTn+y1kbzFHPesTBp2gPiSzD4Y02jtLF3DaZ7DAUNi/+NHoh+ieDqOSs0mpgAYbrQ\nCFBN7wcYjrv08rzYTnYcgU//vraLkBB7elmBoVTpCT96wOY8XF0tKLQDAoGBAIIk\nGpV/KICDlE/4jFs6SnIM0brRP8Tu7eekzzrJVyN4eXGHh8rrRXlkCEG/iTVhM6Fr\ngMe79tHIEQ7/H/gBPcOl0Bug2Vj2zoNe4aj5tlctHu9ls25hvw5yYQODFEZsFDGg\n4W8D1wENZkGJMV7xY47PtHmAfLsnU1emf0N0aoa5AoGAJyC/00sn/zbkRNG58czR\ncuyCWkDyInMi3JhF+jKFD/3IVFoLFcqoerDlr5MsFn9IxUQ9CLWa/UIDiiZYHJIn\nBfpudiykOeUXBJXS4WNWHIOwedTtPLVXf3YwwmGvZSkttZUXjEw5JeqNanpBpCw6\n7i1UyZNyRvaS6ry2EW5HcfM=\n-----END PRIVATE KEY-----\n",
//   "client_email": "cloutcloinclub@servers4sqldb.iam.gserviceaccount.com",
//   "client_id": "110059448242111104944",
//   "auth_uri": "https://accounts.google.com/o/oauth2/auth",
//   "token_uri": "https://oauth2.googleapis.com/token",
//   "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
//   "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/cloutcloinclub%40servers4sqldb.iam.gserviceaccount.com",
//   "universe_domain": "googleapis.com"
// }


// const uploadToFirebaseStorage = async (filepath, fileName) => {
//     try {
//         const gcs = storage.bucket("bucket_name"); // Removed "gs://" from the bucket name
//         const storagepath = `storage_folder/${fileName}`;
//         const result = await gcs.upload(filepath, {
//             destination: storagepath,
//             predefinedAcl: 'publicRead', // Set the file to be publicly readable
//             metadata: {
//                 contentType: "application/plain", // Adjust the content type as needed
//             }
//         });
//         return result[0].metadata.mediaLink;
//     } catch (error) {
//         console.log(error);
//         throw new Error(error.message);
//     }
// }

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5001',
      'https://microtrax.netlify.app',
      "https://servers4sqldb.uc.r.appspot.com",
      "https://orca-app-j32vd.ondigitalocean.app",
      "https://monkfish-app-mllt8.ondigitalocean.app/",
      "*"
      // Add any other origins you want to allow
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// Enable CORS for all origins and methods
// app.use(cors()); 
app.use(express.json());

// Data storage for admin page
let pageVisits = [];
let recentRequests = [];
const startTime = Date.now();

// Middleware to track page visits and requests
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const geo = geoip.lookup(ip);
  const visit = {
    count: pageVisits.length + 1,
    url: req.originalUrl,
    time: new Date().toISOString(),
    ip: ip,
    location: geo ? `${geo.city}, ${geo.country}` : 'Unknown'
  };
  pageVisits.push(visit);

  const request = {
    method: req.method,
    url: req.originalUrl,
    time: new Date().toISOString(),
    ip: ip
  };
  recentRequests.unshift(request);
  if (recentRequests.length > 20) recentRequests.pop();

  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/user-subscriptions', userSubscriptionRoute);
app.use('/api/public-subscriptions', publicSubscriptionRoute);
app.use('/api/wallet', wallet);
app.use('/api/searchForUsers', searchForUsers);
app.use('/api/messages', messageRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/unlock', unlock);
app.use('/api/subscribe', subscrybe);
app.use('/api/content', content);
app.use('/api/public-content', publicContent);
app.use('/api/user-content', userContent);
app.use('/api/notifications', notifications);
app.use('/api/crypto', crypto);
app.use('/api/coinbase', coinbase);
app.use('/api/cashapp', cashapp);
app.use('/api/admin', admin);
app.use('/api/adminp', adminPurchases);
app.use('/api/adminw', adminWithdraws);
app.use('/api/adminu', adminUsers);
app.use('/api/adminr', adminReports)
app.use('/api/ads/', adServer);
app.use('/api/upload', fileUpload);


// app.use('/api/logs', logs);
// Mount the admin API routes
// app.use('/api/adminp', adminApiRoutes);

// app.use('/api/uploadImage', uploadImage);

// Serve static files from a 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Admin route
app.get('/api/admin', (req, res) => {
  const uptime = Date.now() - startTime;
  res.json({
    pageVisits: pageVisits,
    recentRequests: recentRequests,
    uptime: uptime
  });
});

const notificationsRouter = require('./routes/notifications'); // Adjust path
app.use('/api/notifications', notificationsRouter);

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Root route -- old not needed
// app.get('/adminTemplate', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'admin.html'));
// });

// Admin Dashboard route

app.get('/admin/stats', (req, res) => {
  const uptime = moment.duration(Date.now() - startTime).humanize();
  res.render('admin', { 
    recentRequests: recentRequests, 
    pageVisits: pageVisits, 
    uptime: uptime 
  });
});


// Route to render the admin users page
app.get('/admin/logs', (req, res) => {
  // Add middleware to check if user is admin
  // if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    // return res.redirect('/login?redirect=/admin/users');
  // }
  const uptime = moment.duration(Date.now() - startTime).humanize();
  res.render('logs', { 
    recentRequests: recentRequests, 
    pageVisits: pageVisits, 
    uptime: uptime 
  });
});

// Admin reports page
app.get('/admin/reports', (req, res) => {
  res.render('reports');
});


// Route to render the admin users page
app.get('/admin/users', (req, res) => {
  // Add middleware to check if user is admin
  // if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    // return res.redirect('/login?redirect=/admin/users');
  // }
  res.render('admin-users');
});


app.get('/admin', (req, res) => {
  const uptime = moment.duration(Date.now() - startTime).humanize();
  res.render('admin', { 
    recentRequests: recentRequests, 
    pageVisits: pageVisits, 
    uptime: uptime 
  });
});


// Route to render the admin users page
app.get('/admin/logs', (req, res) => {
  // Add middleware to check if user is admin
  // if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    // return res.redirect('/login?redirect=/admin/users');
  // }
  const uptime = moment.duration(Date.now() - startTime).humanize();
  res.render('logs', { 
    recentRequests: recentRequests, 
    pageVisits: pageVisits, 
    uptime: uptime 
  });
});

// Admin reports page
app.get('/admin/reports', (req, res) => {
  res.render('reports');
});


// Route to render the admin users page
app.get('/admin/users', (req, res) => {
  // Add middleware to check if user is admin
  // if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    // return res.redirect('/login?redirect=/admin/users');
  // }
  res.render('admin-users');
});

// In your server or route file, e.g. server.js or routes/adminPurchases.js
app.get('/admin/purchases', async (req, res) => {
  try {
    // Example: fetch from your existing DB/API
    // You might pass search, statusFilter, etc. as query params if you want server-side filter
    // const [rows] = await db.query(`
    //   SELECT id, username, amount, status, created_at, reference_id, transactionId, type  
    //   FROM purchases
    //   WHERE created_at >= NOW() - INTERVAL 48 HOUR
    //   ORDER BY created_at DESC
    // `);

    const [rows] = await db.query(`
      SELECT * FROM purchases
      WHERE created_at >= NOW() - INTERVAL 48 HOUR
      ORDER BY created_at DESC
    `);

    // Render the EJS template, passing the purchase data
    res.render('adminPurchases', { purchases: rows });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return res.status(500).send('Server Error');
  }
});


// In your server or route file, e.g. server.js or routes/adminPurchases.js
app.get('/admin/withdraws', async (req, res) => {
  try {
    // Example: fetch from your existing DB/API
    // You might pass search, statusFilter, etc. as query params if you want server-side filter
    const [rows] = await db.query(`
      SELECT id, username, amount, status, created_at, reference_id, transactionId, method 
      FROM withdraws
      WHERE created_at >= NOW() - INTERVAL 48 HOUR
      ORDER BY created_at DESC
    `);

    // Render the EJS template, passing the purchase data
    res.render('adminWithdraw', { withdraws: rows });
  } catch (error) {
    console.error('Error fetching withdraws:', error);
    return res.status(500).send('Server Error');
  }
});

// In your server or route file, e.g. server.js or routes/adminPurchases.js
app.get('/admin/dashboard', async (req, res) => {
  try {
    // Example: fetch from your existing DB/API
    // You might pass search, statusFilter, etc. as query params if you want server-side filter
    
    // Render the EJS template, passing the purchase data
    res.render('dashboard', { purchases: rows });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return res.status(500).send('Server Error');
  }
});

// Route to render the admin users page
app.get('/admin/logs', (req, res) => {
  // Add middleware to check if user is admin
  // if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    // return res.redirect('/login?redirect=/admin/users');
  // }
  const uptime = moment.duration(Date.now() - startTime).humanize();
  res.render('logs', { 
    recentRequests: recentRequests, 
    pageVisits: pageVisits, 
    uptime: uptime 
  });
});

app.get('/admin', (req, res) => {
  const uptime = moment.duration(Date.now() - startTime).humanize();
  res.render('admin', { 
    recentRequests: recentRequests, 
    pageVisits: pageVisits, 
    uptime: uptime 
  });
});


// Route to render the admin users page
app.get('/admin/users', (req, res) => {
  // Add middleware to check if user is admin
  // if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    // return res.redirect('/login?redirect=/admin/users');
  // }
  res.render('admin-users');
});

const PORT = 5001;
// const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

//  ################  Stripe  #######################

// This is your test secret API key.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const YOUR_DOMAIN = 'http://localhost:3000';

app.post('/create-checkout-session', async (req, res) => {
  const { amount } = req.query
  console.log("amount: ", amount)

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      line_items: [
        {
          // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
          price: 'price_1QBf9hEViYxfJNd2lG5GH62D',
          quantity: amount || 1,
        },
      ],
      mode: 'payment',
      return_url: `${YOUR_DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}&amount=${amount}`,
    });

    res.send({ clientSecret: session.client_secret });
  } catch (error) {
    res.send({ error: "Checkout failed." });
  }
});

app.get('/session-status', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);

    // The paymentIntent ID is usually stored in session.payment_intent
    const paymentIntentId = session.payment_intent;

    // Retrieve PaymentIntent for more details, including total amounts & breakdown
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log("PyINT: ", paymentIntent)

    // Extract any relevant data, e.g. charges, amount received, etc.
    // const charge = paymentIntent.charges.data[0]; // If only 1 charge
    const amountReceived = paymentIntent.amount; // in cents
    const receiptUrl = paymentIntent.receipt_url;
    const createAt = paymentIntent.created;
    const clientSecret = paymentIntent.clientSecret;
    const paymentID = paymentIntent.id;
    const paymentStatus = paymentIntent.paymentStatus;

    res.json({
      session,
      paymentIntent,
      status: session.status,
      customer_email: session.customer_details.email,
      receipt_url: receiptUrl,
      amount_received_cents: amountReceived,
      created: createAt,
      clientSecret: clientSecret,
      paymentID: paymentID,
      paymentStatus: paymentStatus,
      // ...any other data you need
    });

  } catch (error) {
    console.log("Error retrieving session status:", error);
    res.status(500).send("Error retrieving session status");
  }
});

// ############################# MULTER IMAGE HANDLER ########################


// Serve static files from profile-images
app.use('/profile-images', express.static(path.join(__dirname, 'profile-images')));

// Multer storage configuration
const ServerLocalStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'profile-images'); // Destination folder (local, optional)
  },
  filename: function (req, file, cb) {
    // Generate a unique filename using username and id
    const username = req.body.username;
    const id = req.body.id;
    const ext = path.extname(file.originalname);
    cb(null, `${username}-${id}-${Date.now()}${ext}`);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
};

// Initialize multer
const upload = multer({
  storage: ServerLocalStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});



// ######################## POST PROFILE PIC ###############################

// Endpoint to handle profile picture upload
app.post('/api/upload-profile-picture', upload.single('profilePicture'), async (req, res) => {
  console.log("REQ.FILE:", req.file);
  console.log("REQ.BODY:", req.body);

  const { username, date } = req.body;
  const { userId } = req.body;
  const filePath = req.file.path;


  if (!req.file) {
    return res
      .status(400)
      .json({ message: 'No file uploaded or invalid file type.' });
  }

  // // Use UPDATE when modifying an existing row
  // await db.query(
  //   'UPDATE users SET profilePic = ? WHERE user_id = ?',
  //   [filePath, userId]
  // );

  // 1) Upload to Cloudinary
  const uploadResult = await cloundinaryUpload(req.file.path, userId);
  if (!uploadResult) {
    return res
      .status(500)
      .json({ message: 'Cloudinary upload failed.' });
  }

  // 2) Construct a Cloudinary-based URL instead of local
  const imageUrl = uploadResult.secure_url;

  // (Optional) You could delete the local file if you don't need it anymore:
  // fs.unlink(req.file.path, () => {});

  // You can also save `imageUrl` to your DB if needed

  return res.status(200).json({
    message: 'File uploaded successfully',
    url: imageUrl
  });
});


// ############################# CLOUDNINARY IMAGE TO DB UPLOADER ########################

/**
 * Configure Cloudinary globally (for production, consider using process.env for these values).
 */
cloudinary.config({
  cloud_name: 'dabegwb2z',
  api_key: '464793128734399',
  api_secret: 'yNe3uZ1lgIIeecDqwRzRASq6SMk'
});

/**
 * Upload a local image file to Cloudinary.
 * @param {string} filePath - The local file path (from multer)
 */
const cloundinaryUpload = async (filePath, userId) => {
  try {
    // Upload the actual file from the local file path
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      // Optional transformation parameters, folder naming, etc.
      folder: 'profile_pics',
    });

    console.log('Upload Result:', uploadResult);

    // Use UPDATE when modifying an existing row
    await db.query(
      'UPDATE users SET profilePic = ? WHERE user_id = ?',
      [uploadResult.secure_url, userId]
    );

    return uploadResult;

  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    return null;
  }
};



//  ################################## EJS #####################################

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // For serving static files (CSS, JS)


// Import routes
const adminRoutes = require('./routes/admin');
const { subscribe } = require('diagnostics_channel');
const { Console } = require('console');
const { request } = require('https');
app.use('/admin', adminRoutes);

// ############################# Cron Job ########################

const cron = require('node-cron');
// const db = require('./config/db'); // adjust the path if needed

// // Schedule the job to run every day at 12:00 AM EST
// cron.schedule(
//   '0 0 * * *',
//   async () => {
//     console.log('Running daily deduction job at 12:00 AM EST');
//     try {
//       // For example, subtract a fixed daily amount (e.g., 10 units) from each user account,
//       // but only if the account has sufficient balance.
//       const query = 'SELECT tier FROM accounts WHERE balance >= ?';
//       const [result] = await db.query(query, [dailyDeduction]);
//       const dailyDeduction = 10*result[0].tier; // Adjust this based on your logic
//       const query2 = 'UPDATE accounts SET balance = balance - ? WHERE balance >= ?';
//       const [result2] = await db.query(query2, [dailyDeduction, dailyDeduction]);
//       console.log(`Daily deduction applied to ${result2.affectedRows} accounts.`);
//     } catch (error) {
//       console.error('Error applying daily deduction:', error);
//     }
//   },
//   {
//     timezone: 'America/New_York'
//   }
// );

// Enhanced version with logging and error handling
cron.schedule(
  '0 0 * * *',
  async () => {
    const startTime = new Date();
    console.log(`Starting daily deduction job at ${startTime.toISOString()}`);
    
    try {
      // Begin transaction for data consistency
      await db.query('START TRANSACTION');
      
      // Get accounts that can afford the deduction
      const selectQuery = `
        SELECT id, tier, balance, (10 * tier) as daily_deduction
        FROM accounts 
        WHERE balance >= (10 * tier) AND tier > 0
      `;
      const [eligibleAccounts] = await db.query(selectQuery);
      
      if (eligibleAccounts.length === 0) {
        console.log('No accounts eligible for daily deduction');
        await db.query('COMMIT');
        return;
      }
      
      // Apply deductions
      const updateQuery = `
        UPDATE accounts 
        SET balance = balance - (10 * tier),
            last_deduction = NOW()
        WHERE balance >= (10 * tier) AND tier > 0
      `;
      
      const [result] = await db.query(updateQuery);
      
      // Log the deduction details
      const totalDeducted = eligibleAccounts.reduce((sum, account) => sum + account.daily_deduction, 0);
      
      console.log(`Daily deduction completed:`);
      console.log(`- Accounts processed: ${result.affectedRows}`);
      console.log(`- Total amount deducted: ${totalDeducted}`);
      console.log(`- Average deduction per account: ${(totalDeducted / result.affectedRows).toFixed(2)}`);
      
      // Commit transaction
      await db.query('COMMIT');
      
      const endTime = new Date();
      const duration = endTime - startTime;
      console.log(`Daily deduction job completed in ${duration}ms`);
      
    } catch (error) {
      // Rollback on error
      await db.query('ROLLBACK');
      console.error('Error applying daily deduction:', error);
      
      // Optional: Send alert notification
      // await sendAlertNotification('Daily deduction job failed', error.message);
    }
  },
  {
    timezone: 'America/New_York'
  }
);

// email-service.js
const nodemailer = require('nodemailer');

// Configure nodemailer with your SMTP settings
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'your-email@example.com',
    pass: process.env.SMTP_PASS || 'your-password'
  }
});

// Send password reset email
async function sendPasswordResetEmail(email, username, newPassword) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Admin System" <admin@example.com>',
      to: email,
      subject: 'Your Password Has Been Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333;">Password Reset</h2>
          <p>Hello ${username},</p>
          <p>Your password has been reset by an administrator.</p>
          <p>Your new password is: <strong>${newPassword}</strong></p>
          <p>Please login with this password and change it immediately for security reasons.</p>
          <p style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #777;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

module.exports = {
  sendPasswordResetEmail
};

// Crypto Payments Update

app.post('/api/lookup-transaction', async (req, res) => {

  FetchRecentTransactionsCron();

  // wait a few seconds to allow the cron job to possibly update the database
  // await new Promise((timeout) => setTimeout(timeout, 1000)); // wait 5 seconds for the cron to possibly update the DB


  // key value pairs: ETH, BTC, LTC, SOL, XRP
  const blockchainMap = {
    "ethereum": "ETH",
    "bitcoin": "BTC",
    "litecoin": "LTC",
    "solana": "SOL",
    "xrp": "XRP"
  };

  try {
    const { sendAddress, blockchain, transactionHash } = req.body;
    console.log('Lookup transaction body -request:', { sendAddress, blockchain, transactionHash });
    
    let tx = [];
    let result = null;
    
    if (blockchain === "bitcoin" || blockchain === "BTC") {
      [tx] = await pool.execute(
        `SELECT * FROM CryptoTransactions_BTC WHERE direction = 'IN' AND hash = ?`,
        [transactionHash]
      );
      console.log('Lookup transaction result for bitcoin:', tx.length > 0 ? tx[0] : 'No transaction found');
      
      if (tx.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      result = tx[0];
    }
    else if (blockchain === "ethereum" || blockchain === "ETH") {
      [tx] = await pool.execute(
        `SELECT * FROM CryptoTransactions_ETH WHERE direction = 'IN' AND hash = ?`,
        [ transactionHash]
      );
      console.log('Lookup transaction result for ethereum:', tx.length > 0 ? tx[0] : 'No transaction found');
      
      if (tx.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      result = tx[0];
    }
    else if (blockchain === "litecoin" || blockchain === "LTC") {
      [tx] = await pool.execute(
        `SELECT * FROM CryptoTransactions_LTC WHERE direction = 'IN' AND hash = ?`,
        [transactionHash]
      );
      console.log('Lookup transaction result for litecoin:', tx.length > 0 ? tx[0] : 'No transaction found');
      
      if (tx.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      result = tx[0];
    }
    else if (blockchain === "solana" || blockchain === "SOL") {
      [tx] = await pool.execute(
        `SELECT * FROM CryptoTransactions_SOL WHERE direction = 'IN' AND hash = ?`,
        [transactionHash]
      );
      console.log('Lookup transaction result for solana:', tx.length > 0 ? tx[0] : 'No transaction found');
      
      if (tx.length === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      result = tx[0];
    }
    else {
      return res.status(400).json({ error: 'Unsupported blockchain. Use bitcoin, ethereum, litecoin, or solana' });
    }

    result.found = true;

    res.json(result);

  } catch (error) {
    console.error('Lookup transaction error:', error);
    res.status(500).json({ error: 'Database error - transaction lookup failed' });
  }

});

// --- Configurable backends (Esplora-compatible) ---
const BTC_ESPLORA = process.env.BTC_ESPLORA || 'https://blockstream.info/api';
const LTC_ESPLORA = process.env.LTC_ESPLORA || 'https://litecoinspace.org/api';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

function ts(sec) {
  if (!sec) return '';
  return new Date(sec * 1000).toISOString().replace('T', ' ').replace('Z', ' UTC');
}
function fmt(amount, decimals) {
  const d = BigInt(10) ** BigInt(decimals);
  const n = BigInt(amount);
  const whole = (n / d).toString();
  const frac = (n % d).toString().padStart(decimals, '0');
  return `${whole}.${frac}`.replace(/\.?0+$/, '');
}

// -------- BTC/LTC via Esplora (Blockstream/mempool/litecoinspace) --------
// Docs: /api/address/:addr/txs (newest first, first page) and /txs/chain?last_seen=txid for paging.
// BTC docs (Esplora): blockstream.info explorer API / mempool.space REST. LTC: litecoinspace.org API.
async function fetchEsploraAddressTxs(baseUrl, address, limit = 100) {
  // First page (newest): /address/:addr/txs returns up to ~25 (varies with deployment)
  const rows = [];
  const seen = new Set();
  let url = `${baseUrl}/address/${address}/txs`;

  while (rows.length < limit && url) {
    const { data } = await axios.get(url, { timeout: 20000 });
    if (!Array.isArray(data) || data.length === 0) break;

    for (const tx of data) {
      if (seen.has(tx.txid)) continue;
      seen.add(tx.txid);

      // Compute net sats for this address from vin/vout
      let spent = 0n, recv = 0n;
      for (const vin of tx.vin || []) {
        const addrs = vin.prevout?.scriptpubkey_address ? [vin.prevout.scriptpubkey_address] : (vin.prevout?.address ? [vin.prevout.address] : []);
        if (addrs.some(a => a && a.toLowerCase() === address.toLowerCase())) {
          spent += BigInt(vin.prevout?.value ?? 0);
        }
      }
      for (const vout of tx.vout || []) {
        const addrs = vout.scriptpubkey_address ? [vout.scriptpubkey_address] : (vout.address ? [vout.address] : []);
        if (addrs.some(a => a && a.toLowerCase() === address.toLowerCase())) {
          recv += BigInt(vout.value ?? 0);
        }
      }
      const net = recv - spent; // sats
      const direction = net > 0n ? 'IN' : net < 0n ? 'OUT' : '—';

      // crude counterparty guess
      let fromAddr = null, toAddr = null;
      if (direction === 'IN') {
        const otherIn = tx.vin?.find(v => (v.prevout?.scriptpubkey_address || '').toLowerCase() !== address.toLowerCase());
        fromAddr = otherIn?.prevout?.scriptpubkey_address || null;
        toAddr = address;
      } else if (direction === 'OUT') {
        fromAddr = address;
        const otherOut = tx.vout?.find(v => (v.scriptpubkey_address || '').toLowerCase() !== address.toLowerCase());
        toAddr = otherOut?.scriptpubkey_address || null;
      }

      rows.push({
        time: ts(tx.status?.block_time),
        direction,
        amount: fmt((net < 0n ? -net : net).toString(), 8),
        from: fromAddr,
        to: toAddr,
        hash: tx.txid
      });
      if (rows.length >= limit) break;
    }

    if (rows.length >= limit || data.length === 0) break;
    // Next page: /address/:addr/txs/chain/:last_txid  (Esplora supports last_seen)
    const last = data[data.length - 1]?.txid;
    if (!last) break;
    url = `${baseUrl}/address/${address}/txs/chain/${last}`;
  }

  return rows.slice(0, limit);
}

// -------- ETH via Etherscan --------

/**
 * Fetch transactions for an address using Etherscan API V2.
 * @param {string} address        - The wallet address to look up.
 * @param {number} limit          - Max number of transactions to fetch.
 * @param {number} chainId        - Numeric chain ID (e.g., 1 = Ethereum mainnet).
 * @param {string} action         - E.g., "txlist", "getdeposittxs", etc.
 * @param {object} extraParams    - Any extra query params (e.g., from-address filter).
 */
async function fetchEth({
  address,
  limit = 100,
  chainId = 1,
  action = "txlist",
  extraParams = {}
}) {
  const url = `https://api.etherscan.io/v2/api`;
  const params = {
    apikey: ETHERSCAN_API_KEY,
    chainid: chainId,
    module: "account",            // adjust if other module
    action,
    address,
    startblock: 0,
    endblock: 99999999,
    page: 1,
    offset: Math.min(100, limit),
    sort: "desc",
    ...extraParams
  };
  console.log("Etherscan Address:", params.address, "Action:", action, "ChainID:", chainId);

  try {
    const { data } = await axios.get(url, { params, timeout: 20000 });

    if (data.status !== "1") {
      // handle “no results” vs error
      if (data.message && data.message.includes("No transactions found")) {
        return [];
      }
      throw new Error(`Etherscan V2 error: ${data.message} - ${JSON.stringify(data.result)}`);
    }

    // Ensure result is array
    if (!Array.isArray(data.result)) {
      throw new Error(`Unexpected result format: ${JSON.stringify(data.result)}`);
    }

    // Map over the results similarly to your previous logic
    const me = address.toLowerCase();
    return data.result.slice(0, limit).map(t => {
      const from = (t.from || "").toLowerCase();
      const to = (t.to || "").toLowerCase();
      const dir = (to === me && from !== me) ? "IN"
        : (from === me && to !== me) ? "OUT"
          : "—";

      //       // Example Response

      //       {
      //   "status": "1",
      //   "message": "OK",
      //   "result": [
      //     {
      //       "blockNumber": "23666665",
      //       "blockHash": "0xabf940d34137c7104c7b1f1c4f1049433417d4b4c3e360024062f5066ad92a9f",
      //       "timeStamp": "1761542519",
      //       "hash": "0xb838805293426888a8e44c7a42a3775bf7e2b8c5a779bcd59544dc9cc0bdeaae",
      //       "nonce": "1629552",
      //       "transactionIndex": "88",
      //       "from": "0x6081258689a75d253d87ce902a8de3887239fe80",
      //       "to": "0x9a61f30347258a3d03228f363b07692f3cbb7f27",
      //       "value": "1240860000000000",
      //       "gas": "21000",
      //       "gasPrice": "114277592",
      //       "input": "0x",
      //       "methodId": "0x",
      //       "functionName": "",
      //       "contractAddress": "",
      //       "cumulativeGasUsed": "5026825",
      //       "txreceipt_status": "1",
      //       "gasUsed": "21000",
      //       "confirmations": "20522",
      //       "isError": "0"
      //     }
      //   ]
      // }

      console.log("Etherscan V2 tx:", t);

      // Note: Ensure field names match what the V2 endpoint returns
      return {
        time: new Date(Number(t.timeStamp) * 1000).toISOString(),
        direction: dir,
        amount: t.value /* convert from t.value depending on decimals */,
        from: t.from || null,
        to: t.to || null,
        hash: t.hash
      };
    });

  } catch (error) {
    console.error("fetchEtherscanV2 error:", error.message);
    throw error;
  }
}

// -------- SOL via JSON-RPC --------
async function solRpc(method, params) {
  const { data } = await axios.post(SOLANA_RPC_URL, { jsonrpc: '2.0', id: 1, method, params }, { timeout: 30000 });
  if (data.error) throw new Error(data.error.message || String(data.error));
  return data.result;
}

async function fetchSol(address, limit = 100) {
  const sigs = await solRpc('getSignaturesForAddress', [address, { limit: Math.min(100, limit) }]) || [];
  const out = [];
  for (const s of sigs) {
    const sig = s.signature;
    const tx = await solRpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);
    if (!tx) continue;

    const meta = tx.meta || {};
    const msg = tx.transaction?.message || {};
    const keys = (msg.accountKeys || []).map(k => (typeof k === 'string' ? k : k.pubkey));
    const idx = keys.findIndex(k => (k || '').toLowerCase() === address.toLowerCase());
    let net = 0n;
    if (idx >= 0) {
      const pre = BigInt(meta.preBalances?.[idx] ?? 0);
      const post = BigInt(meta.postBalances?.[idx] ?? 0);
      net = post - pre; // lamports, + is IN
    }
    const direction = net > 0n ? 'IN' : net < 0n ? 'OUT' : '—';
    // simple counterparty
    const cp = keys.find(k => (k || '').toLowerCase() !== address.toLowerCase()) || null;

    out.push({
      time: tx.blockTime ? ts(tx.blockTime) : '',
      direction,
      amount: fmt((net < 0n ? -net : net).toString(), 9),
      from: direction === 'IN' ? cp : (direction === 'OUT' ? address : null),
      to: direction === 'IN' ? address : (direction === 'OUT' ? cp : null),
      signature: sig
    });
    if (out.length >= limit) break;
  }
  return out;
}


const walletAddressMap = {
  BTC: 'bc1q4j9e7equq4xvlyu7tan4gdmkvze7wc0egvykr6',
  LTC: 'ltc1qgg5aggedmvjx0grd2k5shg6jvkdzt9dtcqa4dh',
  SOL: 'qaSpvAumg2L3LLZA8qznFtbrRKYMP1neTGqpNgtCPaU',
  ETH: '0x9a61f30347258A3D03228F363b07692F3CBb7f27',
};

cron.schedule('*/30 * * * *', async () => {

  FetchRecentTransactionsCron();

});


async function FetchRecentTransactionsCron() {
  try {
    console.log('🔄 Fetching recent transactions for all wallet addresses...');
    // Iterate over walletAddressMap entries (key = chain, value = address) for the cron job
    for (const [chainKey, addr] of Object.entries(walletAddressMap)) {
      // const txs = await fetchRe,centTransactions(address);
      const chain = String(chainKey || '').toUpperCase();
      const address = String(addr || '').trim();
      // Use a fixed reasonable limit for cron runs
      const limit = 100;
      try {

        if (!address || !chain) {
          console.log('No address or chain provided');
          continue; // skip this entry
        }
        let rows = [];
        if (chain === 'BTC') rows = await fetchEsploraAddressTxs(BTC_ESPLORA, address, limit);
        else if (chain === 'LTC') rows = await fetchEsploraAddressTxs(LTC_ESPLORA, address, limit);
        else if (chain === 'ETH') rows = await fetchEth({ address, limit, chainId: 1, action: "txlist", extraParams: {} });
        else if (chain === 'SOL') rows = await fetchSol(address, limit);
        else {
          console.log('Unsupported chain. Use BTC, LTC, ETH, SOL');
          continue;
        }
        // return res.status(400).json({ error: 'Unsupported chain. Use BTC, LTC, ETH, SOL' });

        // res.json({ chain, address, count: rows.length, txs: rows });

        let txs = {
          chain,
          address,
          count: rows.length,
          txs: rows
        };
        // console.log(`✅ Fetched ${rows.length} transactions for ${chain} address ${address}`);


        for (const tx of txs.txs) {
          const transactionId = tx.hash;

          // console.log(`Time: ${tx.time}, Direction: ${tx.direction}, Amount: ${tx.amount}, From: ${tx.from}, To: ${tx.to}, Hash: ${tx.hash}`);

          const [existingTxs] = await pool.execute(
            `SELECT * FROM CryptoTransactions_${chain} WHERE hash = ?`,
            [transactionId]
          );

          // Check if transaction already exists
          if (existingTxs.length > 0) {
            // console.log(`Transaction ${transactionId} already exists in the database. Skipping.`);
            continue; // Skip to next transaction
          }

          // Insert new transaction
          await pool.execute(
            `INSERT INTO CryptoTransactions_${chain} (time, direction, amount, fromAddress, toAddress, hash) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              tx.time,
              tx.direction,
              tx.amount,
              tx.from,
              tx.to,
              tx.hash,
            ]
          );

          // console.log(`Inserted transaction ${transactionId} into CryptoTransactions_${chain}`);
        }


      } catch (e) {
        // res.status(500).json({ error: e.message || String(e) });
        console.error(`❌ Error processing transactions for ${chain} address ${address}:`, e);
        continue;
      }
      // console.log(`📈 Recent transactions for ${address}:`, txs);
    }
  } catch (error) {
    console.error('❌ Error fetching recent transactions:', error);
  }

}

// 
//  ##########################  END OF SERVER.JS  #########################
// #########################AD Server Code#####################

