import express from 'express';
require('dotenv').config();
import cors from 'cors';
import initRoutes from './src/routes';
import connectDB from './src/config/mongoDb';
import cookieParser from "cookie-parser";
const { registerSocket } = require('./socket');

const app = express();


app.use(cors({
    origin: process.env.CLIENT_URL?.trim?.() ?? process.env.CLIENT_URL,
    credentials: true,
    methods: ["POST", "GET", "PUT", "DELETE"]
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

connectDB()
initRoutes(app)

// Listen on all network interfaces (0.0.0.0), using provided PORT or default to 5000
const port = process.env.PORT || 5000;
const listener = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${listener.address().port}`);
});

registerSocket(listener)