// ---------------------------REQUIRED MODULES----------------------------------
const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
// ---------------------------RUNNING MODULES-----------------------------------
const app = express();
app.use(express.json());
dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
// -----------------------Initializing SERVER-----------------------------------
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};
// ---------------------------STARTING SERVER-----------------------------------
initializeDBAndServer();
// ----------------- CONVERTING SNAKE CASE TO CAMEL CODE------------------------
// const convertToCamelCaseFromSnakeCase = (object) => {
//   return {
//     tweetId,
//   };
// };
// -----------------------------API-1/POST -------------------------------------
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUserName = `SELECT username FROM user 
  WHERE username = '${username}'`;
  const checkUser = await db.get(getUserName);
  const hashedPassword = await bcrypt.hash(password, 10);
  if (checkUser === undefined) {
    if (password.length > 6) {
      const addUserDetails = `INSERT INTO 
        user(username, password, name, gender)
        VALUES ('${username}', '${hashedPassword}', '${name}', '${gender}')`;
      const addUser = await db.run(addUserDetails);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
// -----------------------------API-2/POST -------------------------------------
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserName = `SELECT * FROM user 
    WHERE username = '${username}'`;
  const checkUser = await db.get(getUserName);
  if (checkUser !== undefined) {
    const comparePassword = await bcrypt.compare(password, checkUser.password);
    if (comparePassword === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "asdfghjkl");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});
// -------------------------TOKEN AUTHENTICATION--------------------------------
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghjkl", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
// -----------------------------API-3/GET---------------------------------------
app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    const { username } = request;
    const getTweets = `SELECT 
        username,
        tweet,
        date_time as dateTime
    FROM tweet LEFT JOIN user ON tweet.user_id = user.user_id
        WHERE tweet.user_id IN (
            SELECT following_user_id FROM follower LEFT JOIN user
            ON follower_user_id = user.user_id
        ) ORDER BY tweet.date_time DESC LIMIT 4;`;
    const feed = await db.all(getTweets);
    response.send(feed);
  }
);
// -----------------------------API-4/GET---------------------------------------
app.get("/user/following/", authenticationToken, async (request, response) => {
  const { username } = request;
  const getFollowing = `SELECT name FROM user WHERE user.user_id IN(
        SELECT following_user_id from user 
        LEFT JOIN follower ON user.user_id = follower_user_id
        WHERE user.username = '${username}');`;
  const following = await db.all(getFollowing);
  response.send(following);
});
// -----------------------------API-5/GET---------------------------------------
app.get("/user/followers/", authenticationToken, async (request, response) => {
  const followers = await db.all(`
    select 
    user.name
    from 
    follower
    left join user on follower.follower_user_id = user.user_id
    where follower.following_user_id = (select user_id from user where username = "${request.username}");
    `);
  response.send(followers);
});
// -----------------------------API-6/GET---------------------------------------
app.get("/tweets/:tweetId/", authenticationToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;
  const getTweetUserId = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId}`;
  const tweetUser = await db.get(getTweetUserId);
  const getUserFollowing = `SELECT follower.following_user_id FROM user 
    JOIN follower ON user.user_id = follower_user_id
    WHERE username = '${username}'`;
  const userFollowing = await db.all(getUserFollowing);
  const validationArray = userFollowing.filter(
    (each) => each.following_user_id == tweetUser.user_id
  );
  if (validationArray.length == 0) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getTweetDetailsQuery = `SELECT 
        tweet.tweet,
        COUNT(DISTINCT like.like_id) AS likes, 
        COUNT(DISTINCT reply.reply_id) AS replies,
        tweet.date_time AS dateTime
        FROM (tweet JOIN like ON tweet.tweet_id = like.tweet_id) AS T
        JOIN reply ON reply.tweet_id = tweet.tweet_id
        WHERE tweet.tweet_id = ${tweetId}`;
    const finalResult = await db.get(getTweetDetailsQuery);
    response.send(finalResult);
  }
});
// -----------------------------API-7/GET---------------------------------------
app.get(
  "/tweets/:tweetId/likes/",
  authenticationToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const getTweetUSerId = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId}`;
    const tweetUser = await db.get(getTweetUSerId);
    const getUserFollowing = `SELECT follower.following_user_id
  FROM user JOIN follower ON user.user_id = follower.follower_user_id
  WHERE username = '${username}'`;
    const userFollowing = await db.all(getUserFollowing);
    const validationArray = userFollowing.filter(
      (each) => each.following_user_id == tweetUser.user_id
    );
    if (validationArray.length == 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getTweetDetailsQuery = `SELECT user.username
      FROM (tweet JOIN like ON tweet.tweet_id = like.tweet_id) AS T JOIN user ON user.user_id = like.user_id
      WHERE tweet.tweet_id = ${tweetId}`;
      console.log(getTweetDetailsQuery);
      const finalResult = await db.all(getTweetDetailsQuery);
      let finalArray = finalResult.map((each) => each.username);
      response.send({ likes: finalArray });
    }
  }
);
// -----------------------------API-8/GET---------------------------------------
app.get(
  "/tweets/:tweetId/replies/",
  authenticationToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const getTweetUSerId = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId}`;
    const tweetUser = await db.get(getTweetUSerId);
    const getUserFollowing = `SELECT follower.following_user_id FROM user 
    JOIN follower ON user.user_id = follower.follower_user_id
    WHERE username = '${username}'`;
    const userFollowing = await db.all(getUserFollowing);
    const validationArray = userFollowing.filter(
      (each) => each.following_user_id == tweetUser.user_id
    );
    if (validationArray.length == 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getTweetDetailsQuery = `SELECT user.name,reply.reply 
      FROM (tweet JOIN reply ON tweet.tweet_id = reply.tweet_id) AS T 
      JOIN user ON user.user_id = reply.user_id 
      WHERE tweet.tweet_id = ${tweetId}`;
      const finalResult = await db.all(getTweetDetailsQuery);
      const finalResponse = {
        replies: finalResult,
      };
      response.send(finalResponse);
    }
  }
);
// -----------------------------API-9/GET---------------------------------------
app.get("/user/tweets/", authenticationToken, async (request, response) => {
  const myTweets = await db.all(`
    select 
    tweet.tweet,
    count(distinct like.like_id) as likes,
    count(distinct reply.reply_id) as replies,
    tweet.date_time
    from
    tweet
    left join like on tweet.tweet_id = like.tweet_id
    left join reply on tweet.tweet_id = reply.tweet_id
    where tweet.user_id = (select user_id from user where username = "${request.username}")
    group by tweet.tweet_id;
    `);
  response.send(
    myTweets.map((item) => {
      const { date_time, ...rest } = item;
      return { ...rest, dateTime: date_time };
    })
  );
});

// -----------------------------API-10/GET--------------------------------------

app.post("/user/tweets/", authenticationToken, async (request, response) => {
  const { tweet } = request.body;
  const { user_id } = await db.get(
    `select user_id from user where username = "${request.username}"`
  );
  await db.run(`
    Insert into tweet
    (tweet, user_id)
    values
    ("${tweet}",${user_id});
    `);
  response.send("Created a Tweet");
});
// -----------------------------API-11/GET--------------------------------------
app.delete(
  "/tweets/:tweetId/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const userTweet = await db.get(`
  select 
  tweet_id, user_id
  from 
  tweet 
  where tweet_id = ${tweetId}
  and user_id = (select user_id from user where username = "${request.username}");
  `);
    if (userTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      await db.run(`
        DELETE FROM tweet
        WHERE tweet_id = ${tweetId}
        `);
      response.send("Tweet Removed");
    }
  }
);
// -----------------------------EXPORT APP--------------------------------------
module.exports = app;
