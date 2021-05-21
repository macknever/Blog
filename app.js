//jshint esversion:6

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const _ = require("lodash");
const aws = require("aws-sdk");

const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");

const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "Our littel secret.",
    resave: false,
    saveUninitialized: false,
    //cookie:{secure:true}
  })
);

app.use(passport.initialize());
app.use(passport.session());
mongoose.set("useCreateIndex", true);
// ! = %21
const mongoDB_Atlas_uri =
  "mongodb+srv://admin-lawrence:Encyc200718%21@cluster0.ssm3m.mongodb.net/";
const mongoDB_local_uri = "mongodb://localhost:27017/";
const dataBaseName = "userDB";

mongoose.connect(mongoDB_Atlas_uri + dataBaseName, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
});

const postSchema = new mongoose.Schema({
  postName: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  postContent: String,
});

// var encKey = "ra5ic1z8jBDzn7WrrfLpRU0yHBdXnO3+JBMJuFM00JU=";
// var sigKey = "0qWz3Ic/G6qVtMGgVcdaLYxxdT3jc6MO+XPyckTaiTA+Dq3CQY1arggJ0M02vJhWvtBkGqBbNimK9SbnsbrKpg==";
//
// userSchema.plugin(encrypt, { encryptionKey: encKey, signingKey: sigKey,encryptedFields: ['password']});

//var secret = "noOnecanguessmyKey";
//userSchema.plugin(encrypt,{secret:process.env.SECRET,encryptedFields:["password"]});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);
const Blog = mongoose.model("Blog", postSchema);

passport.use(User.createStrategy());
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

let s3 = new aws.S3({
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
});

passport.use(
  new GoogleStrategy(
    {
      clientID:
        "817089136106-q87m0tqg095ngg2dnscs7h6tnc25toe6.apps.googleusercontent.com",
      clientSecret: "HkIjSriEEC0XDAjsd-EeLXDB",
      callbackURL: "http://lawrenceblog.herokuapp.com/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, done) {
      console.log(profile);
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return done(err, user);
      });
    }
  )
);

const defaultPost = new Blog({
  postName: "Welcome to the Blog",
  userId: "001",
  postContent:
    "But it is the same with man as with the tree. The more he seeks to rise into the height and light, the more vigorously do his roots struggle earthward, downward, into the dark, the deep - into evil.",
});

// defaultPost.save();
// console.log("saved");

app.get("/", function (req, res) {
  res.render("home");
});
app.get("/login", function (req, res) {
  res.render("login");
});
app.get("/");
app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/blog");
      });
    }
  });
});

app.get("/register", function (req, res) {
  res.render("register");
});

// app.get("/secrets", function (req, res) {
//   User.find({ secret: { $ne: null } }, function (err, foundUsers) {
//     console.log(foundUsers);
//     res.render("secrets", { userWithSecret: foundUsers });
//   });
// });

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/blog", function (req, res) {
  // if there are posts for this usr, server will show them
  // else show blank home page

  Blog.find({ userId: req.user.id }, function (err, foundItem) {
    if (!err) {
      if (foundItem.length > 0) {
        res.render("blog", { posts: foundItem });
      } else {
        res.redirect("empty");
      }
    }
    //res.redirect("empty");
  });
});

//this is a empty welcoming page for user first time registered
app.get("/empty", function (req, res) {
  res.render("empty");
});

app.get("/submit", function (req, res) {
  res.render("submit");
});

app.get("/compose", function (req, res) {
  res.render("compose");
});

app.get("/posts/:postName", function (req, res) {
  let id = req.params.postName;

  Blog.findOne({ _id: id }, function (err, foundPost) {
    if (err) {
      console.log(err);
    } else {
      if (foundPost) {
        res.render("post", {
          title: foundPost.postName,
          content: foundPost.postContent,
        });
      }
    }
  });
});

app.post("/submit", function (req, res) {
  const submittedSecret = req.body.secret;

  User.findById(req.user.id, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      foundUser.secret = submittedSecret;
      foundUser.save(function () {
        res.redirect("/blog");
      });
    }
  });
});

app.post("/compose", function (req, res) {
  const post = new Blog({
    postName: _.capitalize(req.body.postTitle),
    postContent: req.body.postBody,
    userId: req.user.id,
  });

  post.save();

  res.redirect("/blog");
});

// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve redirecting
//   the user to google.com.  After authorization, Google will redirect the user
//   back to this application at /auth/google/callback
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

// GET /auth/google/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/blog");
  }
);

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (!err) {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/blog");
        });
      }
    }
  );
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function () {
  console.log("Server started successfully on local host");
});
