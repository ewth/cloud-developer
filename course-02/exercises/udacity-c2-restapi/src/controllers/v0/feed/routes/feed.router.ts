import { Router, Request, Response } from 'express';
import { FeedItem } from '../models/FeedItem';
import { requireAuth } from '../../users/routes/auth.router';
import * as AWS from '../../../../aws';

const router: Router = Router();

// Get all feed items
router.get('/', async (req: Request, res: Response) => {
    const items = await FeedItem.findAndCountAll({order: [['id', 'DESC']]});
    items.rows.map((item) => {
            if(item.url) {
                item.url = AWS.getGetSignedUrl(item.url);
            }
    });
    res.send(items);
});

// Get a specific resource by primary key
router.get('/:id', async (req: Request, res: Response) => {
    let { id } = req.params;
    // Basic numeric check
    // @todo: think of a nicer way to do this
    if (!id || isNaN(id)) {
        // @todo: this should be a nice format, e.g. a message, error code
        return res.status(400).send("Invalid ID specified")
    }
    // Lookup item by id
    const item = await FeedItem.findOne({ where: { id: id }});
    if (item) {
        return res.send(item);
    }
    // 404 if item not found
    res.status(404).send("Not Found")
});


// update a specific resource
router.patch('/:id', 
    requireAuth, 
    async (req: Request, res: Response) => {
        let { id } = req.params;
        let { caption, url } = req.body;
        if (!id || isNaN(id)) {
            return res.status(400).send("Invalid ID specified")
        }
        if (caption == undefined && url == undefined) {
            return res.status(400).send("Nothing specified to update");
        }
        // Lookup item by id
        const item = await FeedItem.findOne({ where: { id: id }});
        if (item) {
            let changed: Boolean = false;
            if (caption !== undefined) {
                item.caption = caption;
                changed = true;
            }
            if (url !== undefined) {
                item.url = url;
                changed = true;
            }
            if (changed) {
                item.save();
            }
            return res.send(item);
        }
        // 404 if item not found
        res.status(404).send("Not Found")
});


// Get a signed url to put a new item in the bucket
router.get('/signed-url/:fileName', 
    requireAuth, 
    async (req: Request, res: Response) => {
    let { fileName } = req.params;
    const url = AWS.getPutSignedUrl(fileName);
    res.status(201).send({url: url});
});

// Post meta data and the filename after a file is uploaded 
// NOTE the file name is they key name in the s3 bucket.
// body : {caption: string, fileName: string};
router.post('/', 
    requireAuth, 
    async (req: Request, res: Response) => {
    const caption = req.body.caption;
    const fileName = req.body.url;

    // check Caption is valid
    if (!caption) {
        return res.status(400).send({ message: 'Caption is required or malformed' });
    }

    // check Filename is valid
    if (!fileName) {
        return res.status(400).send({ message: 'File url is required' });
    }

    const item = await new FeedItem({
            caption: caption,
            url: fileName
    });

    const saved_item = await item.save();

    saved_item.url = AWS.getGetSignedUrl(saved_item.url);
    res.status(201).send(saved_item);
});

export const FeedRouter: Router = router;