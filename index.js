const express = require("express");
const User = require("./model/user");
const passport = require("passport");
const session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const formatMessage = require("./utils/messages");
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require("./utils/users");
const cors = require("cors");

const app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
require("dotenv").config();

/* mongoose connection */

const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const mongoString = "mongodb://localhost:27017";
const connect = mongoose.connect(mongoString);
const db = mongoose.connection;

// Check database connected or not
connect
  .then(() => {
    console.log("Database Connected Successfully");
  })
  .catch((err) => {
    console.log(err);
    console.log("Database cannot be Connected");
  });

/*
  Session configuration and utilization of the MongoStore for storing
  the session in the MongoDB database
*/
app.use(express.json());

app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "your secret key",
    resave: false,
    saveUninitialized: true,
    store: new MongoStore({ mongoUrl: db.client.s.url }),
  })
);

/*
  Setup the local passport strategy, add the serialize and 
  deserialize functions that only saves the ID from the user
  by default.
*/
const strategy = new LocalStrategy(User.authenticate());
passport.use(strategy);
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(passport.initialize());
app.use(passport.session());

checkAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
};
checkLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
};
app.get("/", checkAuthenticated, (req, res) => {
  res.render("home.ejs", { isAuthenticated: req.isAuthenticated() });
});

/* about */
app.get("/about", (req, res) => {
  res.render("aboutus", { isAuthenticated: req.isAuthenticated() });
});

/* contact us */
app.get("/contact", (req, res) => {
  res.render("contactus", { isAuthenticated: req.isAuthenticated() });
});

/* medical query */

app.get("/medicalquery", (req, res) => {
  res.render("medicalquery", { isAuthenticated: req.isAuthenticated() });
});
const prompt = `You are an AI assistant that is an expert in medical health and is part of a hospital system called HealthEase AI
You know about symptoms and signs of various types of illnesses.
You can provide expert advice on self-diagnosis options in the case where an illness can be treated using a home remedy.
If a query requires serious medical attention with a doctor, recommend them to book an appointment with our doctors
If you are asked a question that is not related to medical health respond with "Im sorry but your question is beyond my functionalities".
If the user greets Hello or Hye then greet tham back.
Do not use external URLs or blogs to refer
Format any lists on individual lines with a dash and a space in front of each line.

>`;
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const apiKey = process.env.GPTAPI;
    // const apiKey = 'sk-proj-SOdJoqvUY87KMzYofbgQT3BlbkFJSNioYD6WWKqKNC2lkNPQ';
    // const prompt = document.getElementById("input_symp").value;
    const endpoint = "https://api.openai.com/v1/chat/completions";
    // Send user message to ChatGPT API
    const data = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt + message,
        },
      ],
    };

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log(data);
        res.status(200).json({ reply: data.choices[0].message.content });
      });
  } catch (error) {
    console.log("🚀 ~ file: index.js:39 ~ app.post ~ error:", error);
    console.error("Error:", error.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

/* login */
app.get("/login", checkLoggedIn, (req, res) => {
  res.render("login.ejs", { isAuthenticated: req.isAuthenticated() });
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    successRedirect: "/",
  }),
  (err, req, res, next) => {
    if (err) next(err);
  }
);

/* signup */

app.get("/signup", checkLoggedIn, (req, res) => {
  res.render("signup.ejs", { isAuthenticated: req.isAuthenticated() });
});

app.post("/signup", function (req, res) {
  User.register(
    new User({
      name: req.body.username,
      username: req.body.email,
    }),
    req.body.password,
    function (err, msg) {
      if (err) {
        res.send(err);
        console.log(err);
      } else {
        console.log("success");
        // res.send({ message: "Successful" });
        res.redirect("/");
      }
    }
  );
});

/* logout */

app.post("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

/* chat room */

app.get("/appointment", (req, res) => {
  res.render("chatpage", { isAuthenticated: req.isAuthenticated() });
});

app.post("/appointment", (req, res) => {
  const { username, room } = req.body;

  res.redirect(`/chat?username=${username}&room=${room}`);
});

app.get("/chat", (req, res) => {
  res.render("chatroom", {
    isAuthenticated: req.isAuthenticated(),
    username: req.query.username,
    room: req.query.room,
  });
});
const botName = "MediChat";
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    socket.emit("message", formatMessage(botName, "Welcome to MediChat!"));

    socket.broadcast.to(user.room).emit("message", formatMessage(botName, `${user.username} has joined the chat!`));

    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));
  });

  socket.on("disconnect", () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit("message", formatMessage(botName, `${user.username} has left the chat!`));

      // send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

/* server start */
const PORT = process.env.PORT || 4000;
http.listen(PORT, () => {
  console.log(`🎯 Server is running on PORT: ${PORT}`);
});
