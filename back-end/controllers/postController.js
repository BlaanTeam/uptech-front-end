const { createError } = require("../utils/globals");
const { Post, Comment, Like, Tag } = require("../models/postModel");
const {
  postSchema,
  postIdSchema,
  feedPostsSchema,
  commentSchema,
  getCommentsSchema,
  commentIdSchema,
} = require("../utils/validationSchema");

// This function will handle retrieving feed posts process
const feedPosts = async (req, res, next) => {
  try {
    // let totalPages = await Post.countDocuments({ isPrivate: false });
    let result = await feedPostsSchema.validateAsync(req.query);
    // TODO : add per page options
    // const perPage = 50;
    // const page = 4;
    let posts = await Post.aggregate([
      { $match: { isPrivate: false } },
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "postId",
          // let: { post_id: "_id" },
          // pipeline: [{ $match: { $expr: { $eq: ["$$post_id", "$postId"] } } }],
          as: "comment_count",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "postUser",
          foreignField: "_id",
          // let: { userId: "_id" },
          // pipeline: [
          //   { $match: { $expr: { $eq: ["$userId", "$postUser"] } } },
          //   { $project: { userName: 1, profile: 1 } },
          // ],
          as: "postUser",
        },
      },
      { $unwind: "$postUser" },
      {
        $addFields: {
          totalComments: { $size: "$comment_count" },
        },
      },
      {
        $project: {
          comments: 0,
          likes: 0,
          tags: 0,
          __v: 0,
          comment_count: 0,
          userInfo: 0,
          "postUser.userPass": 0,
          "postUser.reSendConfirmationTooManyRequest": 0,
          "postUser.forgotPasswordTooManyRequest": 0,
          "postUser.resetPasswordToken": 0,
          "postUser.userMail": 0,
          "postUser.mailConfirmed": 0,
          "postUser.createdAt": 0,
          "postUser.__v": 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: result.offset },
      { $limit: result.limit },
    ]);

    res.json(posts);
  } catch (err) {
    if (err.isJoi === true) {
      err.status = 400;
    }
    next(err);
  }
};

// This function will handle the creating posts process
addPost = async (req, res, next) => {
  try {
    let result = await postSchema.validateAsync(req.body);
    let newPost = new Post({
      postBody: result.postBody,
      postUser: req.currentUser._id,
      isPrivate: result.isPrivate,
    });
    await newPost.save();
    await newPost
      .populate({
        path: "postUser",
        select: "userName profile",
      })
      .execPopulate();
    res.status(201);
    res.json(newPost);
  } catch (err) {
    next(err);
  }
};
// This function will handle the retrieving post process

const getPost = async (req, res, next) => {
  try {
    let result = await postIdSchema.validateAsync(req.params);
    let post = await Post.findOne(
      { _id: result.postId },
      { __v: 0, comments: 0, likes: 0, tags: 0 }
    ).populate({
      path: "postUser",
      select: "userName profile",
    });

    if (!post) throw new createError("Post Not Found", 1021, 404);
    else if (
      post.isPrivate === true &&
      post.postUser._id.toString() !== req.currentUser._id.toString()
    ) {
      throw new createError("You don't have permission !", 1003, 403);
    }
    res.json(post);
  } catch (err) {
    if (err.isJoi === true)
      err = new createError("Post Not Found !", 1021, 404);
    next(err);
  }
};

// This function will handle deleting post process

const deletePost = async (req, res, next) => {
  try {
    let result = await postIdSchema.validateAsync(req.params);
    let post = await Post.findOne(
      { _id: result.postId },
      { __v: 0, comments: 0, likes: 0, tags: 0 }
    ).populate({
      path: "postUser",
      select: "userName profile",
    });
    if (!post) throw new createError("Post Not Found !", 1021, 404);
    else if (post.postUser._id.toString() !== req.currentUser._id.toString()) {
      throw new createError("You don't have permission !", 1003, 403);
    } else if (
      post.isPrivate === true &&
      post.postUser._id.toString() !== req.currentUser._id.toString()
    ) {
      throw new createError("You don't have permission !", 1003, 403);
    }
    await post.remove();
    res.status(204);
    res.end();
  } catch (err) {
    if (err.isJoi === true)
      err = new createError("Post Not Found !", 1021, 404);
    next(err);
  }
};

// This function will handle updating post process

const updatePost = async (req, res, next) => {
  try {
    let result_x = await postIdSchema.validateAsync(req.params);
    let result_y = await postSchema.validateAsync(req.body);
    let post = await Post.findOne(
      { _id: result_x.postId },
      { __v: 0, comments: 0, likes: 0, tags: 0 }
    ).populate({
      path: "postUser",
      select: "userName profile",
    });
    if (!post) throw new createError("Post Not Found !", 1021, 404);
    else if (post.postUser._id.toString() !== req.currentUser._id.toString()) {
      throw new createError("You don't have permission !", 1003, 403);
    } else if (
      post.postUser._id.toString() !== req.currentUser._id.toString()
    ) {
      throw new createError("You don't have permission !", 1003, 403);
    }
    // update documments
    post.postBody = result_y.postBody;
    post.isPrivate = result_y.isPrivate;
    post.updatedAt = Date.now();
    await post.save();
    res.json(post);
  } catch (err) {
    if (err.isJoi === true) {
      err.status = 400;
      err.code = 1049;
    }
    next(err);
  }
};

const getComments = async (req, res, next) => {
  try {
    let result_x = await postIdSchema.validateAsync(req.params);
    let result_y = await getCommentsSchema.validateAsync(req.query);
    let post = await Post.findOne(
      { _id: result_x.postId },
      { comments: 1, postUser: 1, isPrivate: 1 }
    ).populate({
      path: "comments",
      select: "-__v",
      options: {
        sort: "-createdAt",
        skip: result_y.offset,
        limit: result_y.limit,
      },
      populate: {
        path: "commentUser",
        select: "userName profile",
      },
    });
    if (!post) throw new createError("Post Not Found !", 1021, 404);
    else if (
      post.isPrivate === true &&
      post.postUser.toString() !== req.currentUser._id.toString()
    ) {
      console.log(post.isPrivate);
      console.log(post.postUser);
      console.log(req.currentUser._id);
      throw new createError("You don't have permission !", 1003, 403);
    }
    res.json(post);
  } catch (err) {
    if (err.isJoi === true) {
      err.status = 400;
    }
    next(err);
  }
};

const addComment = async (req, res, next) => {
  try {
    let result_x = await postIdSchema.validateAsync(req.params);
    let result_y = await commentSchema.validateAsync(req.body);
    let post = await Post.findOne(
      { _id: result_x.postId },
      { __v: 0 }
    ).populate({
      path: "postUser",
      select: "userName profile",
    });
    if (!post) throw new createError("Post Not Found !", 1021, 404);
    else if (
      post.isPrivate === true &&
      post.postUser._id.toString() !== req.currentUser._id.toString()
    ) {
      throw new createError("You don't have permission !", 1003, 403);
    }
    let comment = new Comment({
      commentBody: result_y.commentBody,
      commentUser: req.currentUser._id,
      postId: result_x.postId,
    });
    await comment.save();
    post.comments.push(comment._id);
    await post.save();
    await comment
      .populate({
        path: "commentUser",
        select: "userName profile",
      })
      .execPopulate();
    res.json({ comment });
  } catch (err) {
    if (err.isJoi === true) {
      err.status = 400;
    }
    next(err);
  }
};

const getComment = async (req, res, next) => {
  try {
    let result = await commentIdSchema.validateAsync(req.params);
    let post = await Post.findOne(
      { _id: result.postId },
      {
        _id: 1,
        isPrivate: 1,
      }
    ).populate({
      path: "postUser",
      select: "_id",
    });
    console.log(
      post.postUser._id.toString() !== req.currentUser._id.toString()
    );
    console.log(post.isPrivate === true);
    if (!post) throw new createError("Post Not Found !", 1021, 404);
    else if (
      post.isPrivate === true &&
      post.postUser._id.toString() !== req.currentUser._id.toString()
    ) {
      throw new createError("You don't have permission !", 1003, 403);
    }
    let comment = await Comment.findOne({ _id: result.commentId }, { __v: 0 })
      .populate({
        path: "postId",
        select: "_id",
      })
      .populate({
        path: "commentUser",
        select: "userName profile",
      });
    if (!comment) throw new createError("Comment Not Found !", 1022, 404);
    // else if (comment.postId._id.toString() !== post._id.toString()) {
    //   throw new createError("You don't have permission !", 1003, 403);
    // }
    res.json(comment);
  } catch (err) {
    if (err.isJoi === true) {
      err.status = 400;
    }
    next(err);
  }
};

const updateComment = async (req, res, next) => {
  try {
    let result_x = await commentIdSchema.validateAsync(req.params);
    let result_y = await commentSchema.validateAsync(req.body);
    let post = await Post.findOne(
      { _id: result_x.postId },
      {
        _id: 1,
        isPrivate: 1,
      }
    ).populate({
      path: "postUser",
      select: "_id",
    });
    console.log(
      post.postUser._id.toString() !== req.currentUser._id.toString()
    );
    console.log(post.isPrivate === true);
    if (!post) throw new createError("Post Not Found !", 1021, 404);
    else if (
      post.isPrivate === true &&
      post.postUser._id.toString() !== req.currentUser._id.toString()
    ) {
      throw new createError("You don't have permission !", 1003, 403);
    }
    let comment = await Comment.findOne({ _id: result_x.commentId }, { __v: 0 })
      .populate({
        path: "postId",
        select: "_id",
      })
      .populate({
        path: "commentUser",
        select: "userName profile",
      });
    if (!comment) throw new createError("Comment Not Found !", 1022, 404);
    else if (comment.postId._id.toString() !== post._id.toString()) {
      throw new createError("You don't have permission !", 1003, 403);
    }
    comment.commentBody = result_y.commentBody;
    comment.updatedAt = Date.now();
    await comment.save();
    res.json(comment);
  } catch (err) {
    if (err.isJoi === true) {
      err.status = 400;
    }
    next(err);
  }
};
const deleteComment = async (req, res, next) => {
  try {
    let result = await commentIdSchema.validateAsync(req.params);
    let post = await Post.findOne(
      { _id: result.postId },
      {
        _id: 1,
        isPrivate: 1,
        comments: 1,
      }
    )
      .populate({
        path: "comments",
        select: "_id",
      })
      .populate({
        path: "postUser",
        select: "_id",
      });
    if (!post) throw new createError("Post Not Found !", 1021, 404);
    else if (
      post.isPrivate === true &&
      post.postUser._id.toString() !== req.currentUser._id.toString()
    ) {
      throw new createError("You don't have permission !", 1003, 403);
    }
    let comment = await Comment.findOne({ _id: result.commentId }, { __v: 0 })
      .populate({
        path: "postId",
        select: "_id",
      })
      .populate({
        path: "commentUser",
        select: "userName profile",
      });
    if (!comment) throw new createError("Comment Not Found !", 1022, 404);
    else if (comment.postId._id.toString() !== post._id.toString()) {
      throw new createError("You don't have permission !", 1003, 403);
    }
    deletedPost = await Post.findOneAndUpdate(
      { _id: result.postId },
      { $pull: { comments: result.commentId } },
      { new: true }
    ).exec();
    await comment.remove();

    res.status(204);
    res.json(post);
  } catch (err) {
    if (err.isJoi === true) {
      err.status = 400;
    }
    next(err);
  }
};

module.exports = {
  feedPosts,
  addPost,
  getPost,
  deletePost,
  updatePost,
  getComments,
  addComment,
  getComment,
  updateComment,
  deleteComment,
};
