// Keep the original comment when rewriting the code:

require('dotenv').config();
const path = require('path');
const cors = require('cors');
const express = require('express');
const db = require('./config/db');
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



const app = express();

// CORS configuration
// const corsOptions = {
//   origin: 'http://localhost:3000', // Replace with your frontend URL
//   credentials: true,
//   optionsSuccessStatus: 200
// };

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5000',
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

// app.use('/api/uploadImage', uploadImage);

// Serve static files from a 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// // Admin route
// app.get('/api/admin', (req, res) => {
//   const uptime = Date.now() - startTime;
//   res.json({
//     pageVisits: pageVisits,
//     recentRequests: recentRequests,
//     uptime: uptime
//   });
// });

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Root route
// app.get('/adminTemplate', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'admin.html'));
// });

// Admin Dashboard route

// app.get('/admin', (req, res) => {
//   const uptime = moment.duration(Date.now() - startTime).humanize();

//   let adminHtml = `
//     <!DOCTYPE html>
//     <html lang="en">
//     <head>
//         <meta charset="UTF-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <title>Admin Dashboard</title>
//         <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
//         <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
//         <style>
//             body { padding-top: 20px; }
//             .table-container { max-height: 400px; overflow-y: auto; }
//         </style>
//     </head>
//     <body>
//         <div class="container">
//             <h1 class="mb-4">Admin Dashboard</h1>
            
//             <div class="card mb-4">
//                 <div class="card-body">
//                     <h5 class="card-title">Server Uptime</h5>
//                     <p class="card-text">${uptime}</p>
//                 </div>
//             </div>

//             <div class="card mb-4">
//                 <div class="card-body">
//                     <h5 class="card-title">Page Visits</h5>
//                     <input type="text" id="visitFilter" class="form-control mb-3" placeholder="Filter visits...">
//                     <div class="table-container">
//                         <table class="table table-striped">
//                             <thead>
//                                 <tr>
//                                     <th>Count</th>
//                                     <th>URL</th>
//                                     <th>Time</th>
//                                     <th>IP</th>
//                                     <th>Location</th>
//                                 </tr>
//                             </thead>
//                             <tbody id="visitsTableBody">
//                                 ${pageVisits.map(visit => `
//                                     <tr>
//                                         <td>${visit.count}</td>
//                                         <td>${visit.url}</td>
//                                         <td>${visit.time}</td>
//                                         <td>${visit.ip}</td>
//                                         <td>${visit.location}</td>
//                                     </tr>
//                                 `).join('')}
//                             </tbody>
//                         </table>
//                     </div>
//                 </div>
//             </div>

//             <div class="card mb-4">
//                 <div class="card-body">
//                     <h5 class="card-title">Recent Requests</h5>
//                     <div class="table-container">
//                         <table class="table table-striped">
//                             <thead>
//                                 <tr>
//                                     <th>Method</th>
//                                     <th>URL</th>
//                                     <th>Time</th>
//                                     <th>IP</th>
//                                 </tr>
//                             </thead>
//                             <tbody>
//                                 ${recentRequests.map(request => `
//                                     <tr>
//                                         <td>${request.method}</td>
//                                         <td>${request.url}</td>
//                                         <td>${request.time}</td>
//                                         <td>${request.ip}</td>
//                                     </tr>
//                                 `).join('')}
//                             </tbody>
//                         </table>
//                     </div>
//                 </div>
//             </div>

//             <button id="refreshButton" class="btn btn-primary">Refresh Data</button>
//         </div>

//         <script>
//             document.getElementById('visitFilter').addEventListener('input', function() {
//                 const filter = this.value.toLowerCase();
//                 const rows = document.querySelectorAll('#visitsTableBody tr');
//                 rows.forEach(row => {
//                     const text = row.textContent.toLowerCase();
//                     row.style.display = text.includes(filter) ? '' : 'none';
//                 });
//             });

//             document.getElementById('refreshButton').addEventListener('click', function() {
//                 location.reload();
//             });
//         </script>
//     </body>
//     </html>
//   `;

//   res.send(adminHtml);
// });

const PORT = process.env.PORT || 5000;
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

// app.get('/session-status', async (req, res) => {
//   try {
//     const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
//     res.send({
//       status: session.status,
//       customer_email: session.customer_details.email
//     });
//   } catch (error) {
//     console.log("Duplicate Order Scam Prevented")
//   }
// });

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


// app.listen(4242, () => console.log('Running on port 4242'));

// // Make sure to parse the raw body, not JSON, for Stripe signature verification:
// app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
//   } catch (err) {
//     console.error('⚠️  Webhook signature verification failed.', err.message);
//     return res.sendStatus(400);
//   }

//   // Handle the event
//   switch (event.type) {
//     case 'checkout.session.completed':
//       const session = event.data.object;
//       // e.g. store in DB, mark purchase as "paid"
//       await handleCheckoutSessionCompleted(session, req.body);
//       break;
//     // ... handle other event types
//     default:
//       console.log(`Unhandled event type ${event.type}`);
//   }

//   // Return a response to acknowledge receipt of the event
//   res.json({ received: true });
// });

// // This is your Stripe CLI webhook secret for testing your endpoint locally.
// const endpointSecret = "whsec_cd7aa6f32da0c2f4898a75fa5c832cea1895e9754e39a2949344cc39f59145e4";

// app.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
//   const sig = request.headers['stripe-signature'];

//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
//   } catch (err) {
//     response.status(400).send(`Webhook Error: ${err.message}`);
//     return;
//   }

//   // Handle the event
//   console.log(`Unhandled event type ${event.type}`);

//   // Return a 200 response to acknowledge receipt of the event
//   response.send();
// });

// Example function that saves to DB, etc.
// async function handleCheckoutSessionCompleted(session, body) {
//   // session contains details like session.payment_intent, etc.
//   const paymentIntentId = session.payment_intent;
//   const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
//   const charge = paymentIntent.charges.data[0];

//   // Save details to DB or mark user as having paid
//   // ...
//   console.log("Body: ", body)

// }

// ############################# MULTER IMAGE HANDLER ########################


// Serve static files from profile-images
app.use('/profile-images', express.static(path.join(__dirname, 'profile-images')));

// Multer storage configuration
const storage = multer.diskStorage({
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
  storage: storage,
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
