const crypto = require("crypto");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const TeacherProfile = require("../models/TeacherProfile");
const { hashPassword } = require("../utils/password");
const { ensureSubjects } = require("../utils/subjects");

const generateTempPassword = () => crypto.randomBytes(9).toString("base64url");
const httpError = (message, status) => Object.assign(new Error(message), { status });

async function credentialsFor(data) {
  if (data.passwordHash) return { passwordHash: data.passwordHash, tempPassword: null };
  const tempPassword = generateTempPassword();
  return { passwordHash: await hashPassword(tempPassword), tempPassword };
}

async function nextRollNumber(className) {
  const rows = await StudentProfile.find({ className }).select("rollNumber").lean();
  const max = rows.reduce((m, r) => {
    const n = parseInt(r.rollNumber, 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return String(max + 1);
}

async function createStudent(data) {
  const { passwordHash, tempPassword } = await credentialsFor(data);
  const user = await User.create({
    name: data.name,
    email: data.email,
    username: data.username,
      phone: data.phone,
    dob: data.dob,
    passwordHash,
    role: "student", // set by the server, never by the client
    mustChangePassword: !!tempPassword,
  });

  try {
    const base = {
      userId: user._id,
      subjects: data.subjects || [],
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
    };

    if (!data.className) {
      await StudentProfile.create(base);
    } else {
      let done = false;
      for (let attempt = 0; attempt < 5 && !done; attempt++) {
        try {
          await StudentProfile.create({
            ...base,
            className: data.className,
            rollNumber: data.rollNumber || (await nextRollNumber(data.className)),
          });
          done = true;
        } catch (err) {
          // an automatic roll number collided: try the next free one
          if (err.code === 11000 && !data.rollNumber && err.keyPattern?.rollNumber) continue;
          throw err;
        }
      }
      if (!done) throw httpError("Could not assign a roll number. Please try again.", 500);
    }
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // rollback: no user without a profile
    throw err;
  }

  await ensureSubjects(data.subjects);
  return {
    user: { id: user.id, name: user.name, email: user.email, username: user.username },
    tempPassword,
  };
}

async function createTeacher(data) {

  const { passwordHash, tempPassword } = await credentialsFor(data);

  const user = await User.create({

    name: data.name,
    email: data.email,
    username: data.username,
    phone: data.phone,
    dob: data.dob,  // Added comma
    passwordHash,
    role: "teacher",
    mustChangePassword: !!tempPassword,

  });


  try {
    await TeacherProfile.create({
      userId: user._id,
      employeeId: data.employeeId,
      classNames: data.classNames || [],
      subjects: data.subjects || [],
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  await ensureSubjects(data.subjects);
  return {
    user: { id: user.id, name: user.name, email: user.email, username: user.username },
    tempPassword,
  };
}

async function updateStudentProfile(userId, { className, subjects }) {
  // If the profile was never saved, create it now (this repairs missing profiles)
  let profile = await StudentProfile.findOne({ userId });
  if (!profile) profile = new StudentProfile({ userId });

  if (className === null) {
    profile.className = undefined;
    profile.rollNumber = undefined;
  } else if (className && profile.className !== className) {
    profile.className = className;
    profile.rollNumber = await nextRollNumber(className);
  }
  if (subjects) profile.subjects = subjects;

  await profile.save();
  await ensureSubjects(subjects);
}

async function updateTeacherProfile(userId, { classNames, subjects }) {
  let profile = await TeacherProfile.findOne({ userId });
  if (!profile) profile = new TeacherProfile({ userId });

  if (classNames) profile.classNames = classNames;
  if (subjects) {
    if (!subjects.length) throw httpError("A teacher needs at least one subject.", 400);
    profile.subjects = subjects;
  }

  await profile.save();
  await ensureSubjects(subjects);
}

async function resetPassword(userId) {
  const tempPassword = generateTempPassword();
  const user = await User.findOneAndUpdate(
    { _id: userId, role: { $ne: "admin" } },
    {
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      $inc: { tokenVersion: 1 },
    },
    { new: true }
  );
  if (!user) throw httpError("User not found", 404);
  return { tempPassword };
}

module.exports = {
  createStudent,
  createTeacher,
  updateStudentProfile,
  updateTeacherProfile,
  resetPassword,
};