const express = require("express");
const session = require("express-session");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const marked = require("marked");

const app = express();

const ADMIN_EMAIL =
"rimsky.yamatov@gmail.com";

app.set("view engine", "ejs");

app.use(express.urlencoded({
    extended: true
}));

app.use(express.static("public"));

app.use(express.static("data"));

app.use(session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false
}));

function loadJSON(path){

    if(!fs.existsSync(path)){
        fs.writeFileSync(path, "[]");
    }

    return JSON.parse(
        fs.readFileSync(path)
    );
}

function saveJSON(path, data){

    fs.writeFileSync(
        path,
        JSON.stringify(data, null, 2)
    );
}

function isAdmin(user){

    if(!user) return false;

    return user.email === ADMIN_EMAIL;
}

function getLikeCount(postId){

    const likes =
    loadJSON("./data/likes.json");

    return likes.filter(
        l => l.postId == postId
    ).length;
}

app.get("/", (req, res) => {

    const posts =
    loadJSON("./data/posts.json");

    posts.reverse();

    res.render("index", {
        user: req.session.user,
        posts,
        marked,
        isAdmin,
        getLikeCount
    });
});

app.get("/register", (req, res) => {

    res.render("register");
});

app.post("/register", async (req, res) => {

    const users =
    loadJSON("./data/users.json");

    const exists = users.find(
        u => u.email === req.body.email
    );

    if(exists){
        return res.send("既に存在");
    }

    const hash =
    await bcrypt.hash(
        req.body.password,
        10
    );

    users.push({
        id: Date.now(),
        name: req.body.name,
        email: req.body.email,
        password: hash,
        profile: ""
    });

    saveJSON(
        "./data/users.json",
        users
    );

    res.redirect("/login");
});

app.get("/login", (req, res) => {

    res.render("login");
});

app.post("/login", async (req, res) => {

    const users =
    loadJSON("./data/users.json");

    const user = users.find(
        u => u.email === req.body.email
    );

    if(!user){
        return res.send("存在しません");
    }

    const ok =
    await bcrypt.compare(
        req.body.password,
        user.password
    );

    if(!ok){
        return res.send("パスワード違い");
    }

    req.session.user = user;

    res.redirect("/");
});

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/");
    });
});

app.get("/write", (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    res.render("write", {
        user: req.session.user
    });
});

app.post("/post", (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    const posts =
    loadJSON("./data/posts.json");

    posts.push({
        id: Date.now(),
        title: req.body.title,
        content: req.body.content,
        author: req.session.user.name,
        authorEmail:
        req.session.user.email,
        createdAt:
        new Date().toLocaleString("ja-JP")
    });

    saveJSON(
        "./data/posts.json",
        posts
    );

    res.redirect("/");
});

app.get("/post/:id", (req, res) => {

    const posts =
    loadJSON("./data/posts.json");

    const comments =
    loadJSON("./data/comments.json");

    const post = posts.find(
        p => p.id == req.params.id
    );

    if(!post){
        return res.send("存在しません");
    }

    const postComments =
    comments.filter(
        c => c.postId == post.id
    );

    res.render("post", {
        post,
        comments: postComments,
        marked,
        user: req.session.user,
        isAdmin,
        getLikeCount
    });
});

app.post("/delete/:id", (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    let posts =
    loadJSON("./data/posts.json");

    const post = posts.find(
        p => p.id == req.params.id
    );

    if(!post){
        return res.send("存在しません");
    }

    if(
        post.authorEmail !==
        req.session.user.email &&
        !isAdmin(req.session.user)
    ){
        return res.sendStatus(403);
    }

    posts = posts.filter(
        p => p.id != req.params.id
    );

    saveJSON(
        "./data/posts.json",
        posts
    );

    res.redirect("/");
});

app.post("/like/:id", (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    const likes =
    loadJSON("./data/likes.json");

    const exists = likes.find(
        l =>
        l.postId == req.params.id &&
        l.user ==
        req.session.user.email
    );

    if(!exists){

        likes.push({
            postId: req.params.id,
            user:
            req.session.user.email
        });

        saveJSON(
            "./data/likes.json",
            likes
        );
    }

    res.redirect(
        "/post/" + req.params.id
    );
});

app.post("/comment/:id", (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    const comments =
    loadJSON("./data/comments.json");

    comments.push({
        id: Date.now(),
        postId: req.params.id,
        author:
        req.session.user.name,
        content: req.body.content
    });

    saveJSON(
        "./data/comments.json",
        comments
    );

    res.redirect(
        "/post/" + req.params.id
    );
});

app.post("/comment-delete/:id", (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    let comments =
    loadJSON("./data/comments.json");

    const comment = comments.find(
        c => c.id == req.params.id
    );

    if(!comment){
        return res.send("存在しません");
    }

    const posts =
    loadJSON("./data/posts.json");

    const post = posts.find(
        p => p.id == comment.postId
    );

    if(
        comment.author !==
        req.session.user.name &&
        post.authorEmail !==
        req.session.user.email &&
        !isAdmin(req.session.user)
    ){
        return res.sendStatus(403);
    }

    comments = comments.filter(
        c => c.id != req.params.id
    );

    saveJSON(
        "./data/comments.json",
        comments
    );

    res.redirect(
        "/post/" + comment.postId
    );
});

app.get("/user/:email", (req, res) => {

    const posts =
    loadJSON("./data/posts.json");

    const users =
    loadJSON("./data/users.json");

    const targetUser = users.find(
        u => u.email === req.params.email
    );

    const userPosts = posts.filter(
        p =>
        p.authorEmail ===
        req.params.email
    );

    res.render("user", {
        profileEmail:
        req.params.email,

        profileText:
        targetUser?.profile ||
        "",

        posts: userPosts,

        marked,

        user:
        req.session.user
    });
});

app.post("/profile", (req, res) => {

    if(!req.session.user){
        return res.redirect("/login");
    }

    const users =
    loadJSON("./data/users.json");

    const user = users.find(
        u =>
        u.email ===
        req.session.user.email
    );

    user.profile =
    req.body.profile;

    saveJSON(
        "./data/users.json",
        users
    );

    req.session.user = user;

    res.redirect(
        "/user/" +
        req.session.user.email
    );
});

const PORT =
process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        "running"
    );
});