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
