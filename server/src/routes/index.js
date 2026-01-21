import authRouter from './auth';
import bioRouter from './bio'
import profileRouter from'./profile'
import postRouter from './post'
import relationshipRouter from './relationship'
import conversationRouter from './conversation'
import searhRouter from './search'
import groupRouter from './group'
import managementRouter from './management'
import reportRouter from './report'
import notificationRouter from './notification'

const initRoutes = (app) => {

    app.use('/auth', authRouter);
    app.use('/bio', bioRouter)
    app.use('/profile', profileRouter)
    app.use('/post', postRouter)
    app.use('/relationship', relationshipRouter)
    app.use('/conversation', conversationRouter)
    app.use('/search', searhRouter)
    app.use('/group', groupRouter)
    app.use('/management', managementRouter)
    app.use('/report', reportRouter)
    app.use('/notification', notificationRouter)

    return app.use('/', (req, res) => {
        res.send('Server is running');
    });
}

export default initRoutes;