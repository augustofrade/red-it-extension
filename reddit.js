(function (mode = "purge") {
  const blocklist = [];

  var blockListString = blocklist.join("|").replace(/\./g, "\\.");
  const blockRegex = new RegExp(blockListString, "gi");

  const resetPost = (post) => {
    post.style.display = "block";
    post.classList.remove("unwanted-post");
    post.style.visibility = "initial";
  };

  const handlePost = (post, titleEl) => {
    const title = titleEl.textContent;

    if (title.match(blockRegex) === null) return;

    console.log(`Detected post: "${title}"`);
    detectedPosts++;
    resetPost(post);

    if (mode === "purge") {
      post.style.display = "none";
    } else if (mode === "cover") {
      post.classList.add("unwanted-post");
    } else if (mode === "hide") {
      post.style.visibility = "hidden";
    }
  };

  let detectedPosts = 0;
  console.log("Running Red-It in mode:", mode);

  function handleOldRedditPosts() {
    for (let post of document.querySelectorAll("#siteTable .thing")) {
      const titleEl = post.querySelector(".title:last-of-type");
      handlePost(post, titleEl);
    }
  }

  function handleNewRedditPosts() {
    for (let post of document.querySelectorAll("shreddit-post")) {
      const titleEl = post.querySelector("[slot='title']");
      handlePost(post, titleEl);
    }
  }

  if (location.hostname.startsWith("old")) {
    handleOldRedditPosts();
  } else {
    handleNewRedditPosts();
  }

  console.log(`${detectedPosts} hidden posts.`);
  document.title = `(${detectedPosts}) ${document.title}`;
  return detectedPosts;
})("cover");
