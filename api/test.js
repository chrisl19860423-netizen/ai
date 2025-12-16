// 测试函数 - 用于验证 Vercel Functions 是否正常工作
module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    message: 'Function is working!',
    method: req.method,
    path: req.url
  });
};

