const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const router = express.Router();
router.use(requireAuth);

async function subjects(userId) {
  return (await pool.query('SELECT id,name FROM subjects WHERE user_id=$1 ORDER BY name', [userId])).rows;
}
router.get('/', asyncHandler(async (req,res) => {
  const result = await pool.query(`SELECT ss.*, s.name AS subject_name FROM study_sessions ss
    LEFT JOIN subjects s ON s.id=ss.subject_id AND s.user_id=ss.user_id
    WHERE ss.user_id=$1 ORDER BY ss.study_date DESC, ss.start_time`, [req.session.user.id]);
  res.render('sessions/index', { title:'Study schedule', sessions:result.rows });
}));
router.get('/new', asyncHandler(async (req,res) => res.render('sessions/form', {
  title:'Add study session', session:{}, subjects:await subjects(req.session.user.id), errors:[], action:'/study-sessions'
})));
router.post('/', body('title').trim().isLength({min:2,max:160}).withMessage('Enter a session title.'),
  body('study_date').isISO8601().withMessage('Choose a valid date.'),
  body('start_time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Enter a valid start time.'),
  body('end_time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Enter a valid end time.'),
  asyncHandler(async (req,res) => {
    const errors=validationResult(req);
    const subjectList=await subjects(req.session.user.id);
    const data={...req.body};
    if (!errors.isEmpty() || req.body.end_time <= req.body.start_time) {
      if (req.body.end_time <= req.body.start_time) errors.errors.push({msg:'End time must be later than start time.'});
      return res.status(400).render('sessions/form',{title:'Add study session',session:data,subjects:subjectList,errors:errors.array(),action:'/study-sessions'});
    }
    const subjectId=req.body.subject_id || null;
    if (subjectId) {
      const own=await pool.query('SELECT id FROM subjects WHERE id=$1 AND user_id=$2',[subjectId,req.session.user.id]);
      if (!own.rowCount) return res.status(400).render('sessions/form',{title:'Add study session',session:data,subjects:subjectList,errors:[{msg:'Select one of your own subjects.'}],action:'/study-sessions'});
    }
    await pool.query(`INSERT INTO study_sessions (user_id,subject_id,title,study_date,start_time,end_time,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.session.user.id,subjectId,req.body.title,req.body.study_date,req.body.start_time,req.body.end_time,req.body.notes||null]);
    req.session.flash={type:'success',message:'Study session added.'};
    res.redirect('/study-sessions');
  }));
router.get('/:id/edit', asyncHandler(async (req,res) => {
  const [found,subjectList]=await Promise.all([
    pool.query('SELECT * FROM study_sessions WHERE id=$1 AND user_id=$2',[req.params.id,req.session.user.id]),
    subjects(req.session.user.id)
  ]);
  if(!found.rowCount) return res.status(404).render('404',{title:'Session not found'});
  res.render('sessions/form',{title:'Edit study session',session:found.rows[0],subjects:subjectList,errors:[],action:`/study-sessions/${req.params.id}?_method=PUT`});
}));
router.put('/:id', body('title').trim().isLength({min:2,max:160}).withMessage('Enter a session title.'),
  body('study_date').isISO8601().withMessage('Choose a valid date.'),
  body('start_time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Enter a valid start time.'),
  body('end_time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Enter a valid end time.'),
  asyncHandler(async (req,res) => {
    const errors=validationResult(req), subjectList=await subjects(req.session.user.id), data={...req.body,id:req.params.id};
    if(!errors.isEmpty() || req.body.end_time<=req.body.start_time) {
      if(req.body.end_time<=req.body.start_time) errors.errors.push({msg:'End time must be later than start time.'});
      return res.status(400).render('sessions/form',{title:'Edit study session',session:data,subjects:subjectList,errors:errors.array(),action:`/study-sessions/${req.params.id}?_method=PUT`});
    }
    const subjectId=req.body.subject_id||null;
    if(subjectId) {
      const own=await pool.query('SELECT id FROM subjects WHERE id=$1 AND user_id=$2',[subjectId,req.session.user.id]);
      if(!own.rowCount) return res.status(400).render('sessions/form',{title:'Edit study session',session:data,subjects:subjectList,errors:[{msg:'Select one of your own subjects.'}],action:`/study-sessions/${req.params.id}?_method=PUT`});
    }
    const result=await pool.query(`UPDATE study_sessions SET subject_id=$1,title=$2,study_date=$3,start_time=$4,end_time=$5,notes=$6
      WHERE id=$7 AND user_id=$8`,
      [subjectId,req.body.title,req.body.study_date,req.body.start_time,req.body.end_time,req.body.notes||null,req.params.id,req.session.user.id]);
    if(!result.rowCount) return res.status(404).render('404',{title:'Session not found'});
    req.session.flash={type:'success',message:'Study session updated.'};
    res.redirect('/study-sessions');
  }));
router.delete('/:id', asyncHandler(async (req,res) => {
  await pool.query('DELETE FROM study_sessions WHERE id=$1 AND user_id=$2',[req.params.id,req.session.user.id]);
  req.session.flash={type:'success',message:'Study session deleted.'};
  res.redirect('/study-sessions');
}));
module.exports=router;
