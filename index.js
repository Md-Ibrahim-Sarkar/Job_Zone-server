const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 7000;
const app = express();
var cookieParser = require('cookie-parser')

app.use(cors({
  origin: ["http://localhost:5173", "https://job-zone-8abf4.firebaseapp.com"],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser())



const verifyToken = (req, res, next) => {
  const token = req.cookies.token

  if (!token) {
    return res.status(401).send({ message: 'No token provided.' });
  }

  jwt.verify(token, process.env.SECTET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Token is not valid.' });
    }
    console.log(decoded);
    req.user = decoded.email;
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kt5fy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {

    const database = client.db('jobsConnectionDB')
    const jobs = database.collection('jobsData')
    const jobBids = database.collection('jobBids')



    // ******************  jwt token  start

    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.SECTET_KEY, { expiresIn: '1h' })
      res.cookie('token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'strict'
      }).send({ token: token })
    })


    //  clear  cookies

    app.get('/clear-cookie', (req, res) => {
      res.clearCookie('token', {
        secure: false,
        sameSite: 'strict'
      }).send({ message: 'Logged out' })
    })

    // ***************************** end

    // ********************   Add a jobs to the database ****************

    app.post('/jobs', async (req, res) => {
      const data = await req.body;
      const result = await jobs.insertOne(data)
      res.send(result)
    })

    //  *********************** get all jobs ***********************

    app.get('/jobs', async (req, res) => {
      const result = await jobs.find().toArray()
      res.send(result)
    })


    // ******************************* get all jobs for filter *******************************


    app.get('/all-jobs', async (req, res) => {

      const filter = req.query.filter
      const search = req.query.search
      const sort = req.query.sort


      let options = {}

      if (sort) options = {
        sort: { dateLine: sort === 'asc' ? 1 : -1 }
      }
      let query = {
        job_title: {
          $regex: search,
          $options: 'i'
        }
      };
      if (filter) query.category = filter;
      const result = await jobs.find(query, options).toArray()

      res.send(result)
    })

    // ************************* get email base jobs data ********************************

    app.get('/jobs/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = req.user

      if (email !== user) {
        return res.status(403).send({ message: 'Not authorized to access this user\'s data.' });
      }
      const result = await jobs.find({ 'buyer.email': email }).toArray()
      res.send(result)
    })


    // ************************* delete a job ************************

    app.delete('/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const result = await jobs.deleteOne({ _id: new ObjectId(id) })
      res.send(result)
    })

    // *********************** get one data by id ***********************
    app.get('/jobs/id/:id', async (req, res) => {
      const id = req.params.id;
      const result = await jobs.findOne({ _id: new ObjectId(id) })
      res.send(result);
    });



    // ************************** update a job ************************
    app.put('/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const updatedJob = req.body;
      const result = await jobs.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedJob }
      );
      res.send(result);
    });



    //  *********************** job bids ********************************

    app.post('/bids', async (req, res) => {
      const data = req.body

      const query = { email: data.email, jobId: data.jobId }
      const exist = await jobBids.findOne(query)
      if (exist) {
        return res.status(409).send({ message: 'Bid already exists for this job and email' });
      }

      // update the total bids number in the jobs collection
      const filter = { _id: new ObjectId(data.jobId) }
      const update = { $inc: { total_bids: 1 } }
      const job = await jobs.findOneAndUpdate(
        filter,
        update
      )

      const result = await jobBids.insertOne(data)

      res.send(result)
    })

    //  *************************** GET All Bids ************************
    app.get('/bids', async (req, res) => {
      const result = await jobBids.find().toArray()
      res.send(result)
    })


    //  bids request
    app.get('/bids-request/:email', async (req, res) => {

      const email = req.params.email;
      const result = await jobBids.find({ buyer: email }).toArray()
      res.send(result)
    })

    // change a bid request

    app.patch('/bids/:id', async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const query = { _id: new ObjectId(id) }
      const updatedBidRequest = { $set: { status } }
      const result = await jobBids.updateOne(query, updatedBidRequest);
      res.send(result);

    })








    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello from jobsZone Server....");
});

app.listen(port, () => console.log(`Server running on port ${port}`));
