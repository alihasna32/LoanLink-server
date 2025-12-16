require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

const app = express();
// middleware
app.use(
  cors({
    // origin:"loanlink-project-323.netlify.app",
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log(decoded);
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const db = client.db("LoanLink-server");
    const loanCollection = db.collection("loans");
    const applicationCollection = db.collection("loanApplications");
    const usersCollection = db.collection("users");

        // middleware

    const verifyADMIN = async (req, res, next) => {
      const email = req.tokenEmail
      const user = await usersCollection.findOne({ email })
      if (user?.role !== 'admin')
        return res
          .status(403)
          .send({ message: 'Admin only Actions!', role: user?.role })

      next()
    }
const verifyMANAGER = async (req, res, next) => {
      const email = req.tokenEmail
      const user = await usersCollection.findOne({ email })
      if (user?.role !== 'manager')
        return res
          .status(403)
          .send({ message: 'Manager only Actions!', role: user?.role })

      next()
    }

    app.post("/all-loans", async (req, res) => {
      const loanData = req.body;
      const result = await loanCollection.insertOne(loanData);
      res.send(result);
    });


    app.get("/available-loans", async (req, res) => {
      try {

        let result = await loanCollection
          .find({ showOnHome: true })
          .sort({ _id: -1 })
          .toArray();


        if (result.length < 6) {
          const excludeIds = result.map((loan) => loan._id);
          const remaining = await loanCollection
            .find({ _id: { $nin: excludeIds } })
            .limit(6 - result.length)
            .toArray();

          result = [...result, ...remaining];
        }

        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch available loans" });
      }
    });
    app.get("/all-loans", async (req, res) => {
          const { limit = 0, skip = 0 } = req.query
          const result = await loanCollection.find().limit(Number(limit)).skip(Number(skip)).toArray();
          res.send(result);
        });
    
    
        app.get("/all-loans/:id", async (req, res) => {
          const id = req.params.id;
    
          const result = await loanCollection.findOne({ _id: new ObjectId(id) });
          res.send(result);
        });
    app.post("/loan-application", verifyJWT, async (req, res) => {
      try {
        const applicationData = req.body;


        applicationData.status = "Pending";
        applicationData.applicationFeeStatus = "Unpaid";
        applicationData.userEmail = req.tokenEmail;
        applicationData.createdAt = new Date();

        const result = await applicationCollection.insertOne(applicationData);
        res.send(result);
      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Failed to submit loan application" });
      }
    });

    // save user in db

    app.post("/user", async (req, res) => {
      const userData = req.body;
      userData.created_at = new Date().toISOString();
      userData.last_loggedIn = new Date().toISOString();
      userData.role = userData.role || "borrower";

      const query = {
        email: userData.email,
      };

      const alreadyExists = await usersCollection.findOne(query);
      console.log("User Already Exists---> ", !!alreadyExists);

      if (alreadyExists) {
        console.log("Updating user info......");
        const result = await usersCollection.updateOne(query, {
          $set: {
            last_loggedIn: new Date().toISOString(),
          },
        });
        return res.send(result);
      }

      console.log("Saving new user info......");
      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });

app.get("/admin-seed/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.updateOne(
        { email },
        { $set: { role: "admin" } }
      );
      res.send(result);
    });

    app.get("/user/role", verifyJWT, async (req, res) => {
      const result = await usersCollection.findOne({ email: req.tokenEmail });
      res.send({ role: result?.role });
    });
    // borrower apis
    
        app.get("/my-loans/:email", verifyJWT, async (req, res) => {
          try {
            const email = req.params.email;
    
            if (email !== req.tokenEmail) {
              return res.status(403).send({ message: "Forbidden access" });
            }
    
            const result = await applicationCollection
              .find({ userEmail: email })
              .sort({ createdAt: -1 })
              .toArray();
    
            res.send(result);
          } catch (err) {
            console.log(err);
            res.status(500).send({ message: "Failed to fetch loans" });
          }
        });
    
        app.patch("/loan-application/:id", verifyJWT, async (req, res) => {
          try {
            const { id } = req.params;
            const updateData = req.body;
    
            const loan = await applicationCollection.findOne({
              _id: new ObjectId(id),
            });
    
            if (!loan) return res.status(404).send({ message: "Loan not found" });
            if (loan.userEmail !== req.tokenEmail)
              return res.status(403).send({ message: "Forbidden" });
    
            const result = await applicationCollection.updateOne(
              { _id: new ObjectId(id) },
              { $set: updateData }
            );
    
            res.send(result);
          } catch (err) {
            console.log(err);
            res.status(500).send({ message: "Failed to update loan" });
          }
        });
    

  } catch (err) {
    console.log(err);
  } finally {
    // await client.close();
  }
}
  run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("loanlink server is running..");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  if (!process.env.STRIPE_SECRET_KEY) console.warn("WARNING: STRIPE_SECRET_KEY is not set in .env");
  if (!process.env.CLIENT_DOMAIN) console.warn("WARNING: CLIENT_DOMAIN is not set in .env");
});
