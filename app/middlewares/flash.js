// Flash message: existe só para a próxima requisição (gravada antes do redirect).
module.exports = function flash(req, res, next) {
  if (req.session.flash) {
    res.locals.flashMessage = req.session.flash;
    delete req.session.flash;
    req.session.save(() => next());
  } else {
    res.locals.flashMessage = null;
    next();
  }
};
