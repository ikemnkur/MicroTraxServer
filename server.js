require('dotenv').config();
const path = require('path');
const cors = require('cors');
const express = require('express');
const geoip = require('geoip-lite');
const moment = require('moment')
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const transactionRoutes = require('./routes/transactions');
const subscriptionRoutes = require('./routes/subscriptions');
const wallet = require('./routes/wallet');
const searchForUsers = require('./routes/searchForUsers');
const messageRoutes = require('./routes/messages');
const paymentRoutes = require('./routes/paymentRoutes');
const content = require('./routes/content');
const unlock = require('./routes/content');

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
      "https://orca-app-j32vd.ondigitalocean.app"
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
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/wallet', wallet);
app.use('/api/users', searchForUsers);
app.use('/api/messages', messageRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/unlock', unlock);
app.use('/api/content', content);

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

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Root route
app.get('/adminTemplate', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


// Admin Dashboard route
app.get('/admin', (req, res) => {
  const uptime = moment.duration(Date.now() - startTime).humanize();

  let adminHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
        <style>
            body { padding-top: 20px; }
            .table-container { max-height: 400px; overflow-y: auto; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="mb-4">Admin Dashboard</h1>
            
            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title">Server Uptime</h5>
                    <p class="card-text">${uptime}</p>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title">Page Visits</h5>
                    <input type="text" id="visitFilter" class="form-control mb-3" placeholder="Filter visits...">
                    <div class="table-container">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Count</th>
                                    <th>URL</th>
                                    <th>Time</th>
                                    <th>IP</th>
                                    <th>Location</th>
                                </tr>
                            </thead>
                            <tbody id="visitsTableBody">
                                ${pageVisits.map(visit => `
                                    <tr>
                                        <td>${visit.count}</td>
                                        <td>${visit.url}</td>
                                        <td>${visit.time}</td>
                                        <td>${visit.ip}</td>
                                        <td>${visit.location}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title">Recent Requests</h5>
                    <div class="table-container">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Method</th>
                                    <th>URL</th>
                                    <th>Time</th>
                                    <th>IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recentRequests.map(request => `
                                    <tr>
                                        <td>${request.method}</td>
                                        <td>${request.url}</td>
                                        <td>${request.time}</td>
                                        <td>${request.ip}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <button id="refreshButton" class="btn btn-primary">Refresh Data</button>
        </div>

        <script>
            document.getElementById('visitFilter').addEventListener('input', function() {
                const filter = this.value.toLowerCase();
                const rows = document.querySelectorAll('#visitsTableBody tr');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(filter) ? '' : 'none';
                });
            });

            document.getElementById('refreshButton').addEventListener('click', function() {
                location.reload();
            });
        </script>
    </body>
    </html>
  `;

  res.send(adminHtml);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));




// This is your test secret API key.
const stripe = require('stripe')('sk_test_51OPgiOEViYxfJNd2Mp4NrKUMHAqfoRBAtj5dKCxD1VWbHNSYZEIERtq6ZaRCUttKEyY9kvDWxVM4I4QcoK2Nikv600rOQZmvTh');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const express = require('express');
// const app = express();
app.use(express.static('public'));

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

  res.send({ clientSecret: session.client_secret });  } 
  catch (error) {
    res.send({ error: "Checkout failed." });
  }
  
  
});


app.get('/session-status', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);

    res.send({
      status: session.status,
      customer_email: session.customer_details.email
    });
  } catch (error) {
    console.log("Duplicate Order Scam Prevented")
  }


});

app.listen(4242, () => console.log('Running on port 4242'));