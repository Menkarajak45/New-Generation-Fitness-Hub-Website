import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();
const schema=new mongoose.Schema({name:String,email:{type:String,unique:true},phone:String,password:String,role:String,active:Boolean},{timestamps:true});
const User=mongoose.model("User",schema);
const uri=process.env.MONGODB_URI||"mongodb://127.0.0.1:27017/new_generation_fitness_hub";
if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD){console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first.");process.exit(1);}
if(process.env.ADMIN_PASSWORD.length<12){console.error("ADMIN_PASSWORD must be at least 12 characters.");process.exit(1);}
await mongoose.connect(uri);
const email=process.env.ADMIN_EMAIL.toLowerCase();
const existing=await User.findOne({email});
if(existing){console.log("An account with this email already exists. No changes made.");}
else{await User.create({name:process.env.ADMIN_NAME||"Gym Administrator",email,phone:process.env.ADMIN_PHONE||"",password:await bcrypt.hash(process.env.ADMIN_PASSWORD,12),role:"admin",active:true});console.log("Admin account created successfully.");}
await mongoose.disconnect();
