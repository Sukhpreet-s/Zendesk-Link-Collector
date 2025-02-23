// Scroll to the comment with the given commentID or auditID.
// Actual scrolling is done in the content script.
function scrollToComment(data) {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    browser.tabs.sendMessage(tabs[0].id, {
      type: "scroll",
      commentID: data.commentID,
      auditID: data.auditID,
    });
  });
}

// Write the configurable summary to the clipboard.
function writeSummaryClipboard() {
  let summary = "";
  document.querySelectorAll(".list-links").forEach((list) => {
    // If "all" summary type, add all to summary.
    if (list.getAttribute("data-summary-type") == "all") {
      summary += `### ${list.getAttribute("data-title")}\n\n`;
      list.childNodes.forEach((li) => {
        summary += `- [${li.textContent}](${
          li.querySelector("a").href
        }) - ${li.getAttribute("data-created-at")}\n`;
      });
      summary += "\n";
      // If "latest" summary type, add only the latest to summary.
    } else if (list.getAttribute("data-summary-type") == "latest") {
      summary += `### ${list.getAttribute("data-title")} (Latest)\n\n`;
      const latest = list.childNodes[list.childNodes.length - 1];
      summary += `- [${latest.textContent}](${
        latest.querySelector("a").href
      }) - ${latest.getAttribute("data-created-at")}\n`;
      summary += "\n";
    }
  });
  if (summary != "") {
    navigator.clipboard.writeText(summary);
    document.getElementById("summary-copy").classList.add("hidden");
    document.getElementById("summary-check").classList.remove("hidden");
    document.getElementById("summary-text").textContent = "Copied!";
    // Hide the checkmark after 2 seconds.
    setTimeout(() => {
      document.getElementById("summary-check").classList.add("hidden");
      document.getElementById("summary-copy").classList.remove("hidden");
      document.getElementById("summary-text").textContent = "Summary";
    }, 2000);
  }
}

//Write a link to the clipboard in markdown format.
function writeLinkClipboard(text, href) {
  const link = `[${text}](${href})`;
  navigator.clipboard.writeText(link);
}

// Code from https://stackoverflow.com/questions/55214828/how-to-make-a-cross-origin-request-in-a-content-script-currently-blocked-by-cor/55215898#55215898
async function fetchResource(input, init) {
  const type = "fetch";
  return new Promise((resolve, reject) => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      browser.tabs
        .sendMessage(tabs[0].id, { type, input, init })
        .then((messageResponse) => {
          const [response, error] = messageResponse;
          if (response === null) {
            reject(error);
          } else {
            // Use undefined on a 204 - No Content
            const body = response.body ? new Blob([response.body]) : undefined;
            resolve(
              new Response(body, {
                status: response.status,
                statusText: response.statusText,
              })
            );
          }
        });
    });
  });
}

async function displayLinks(linksBundle) {
  // If there are no links, display a message and return.
  if (
    linksBundle.length <= 0 &&
    document.querySelectorAll("#list-container-links .list-links").length <= 0
  ) {
    document
      .getElementById("not-found-container-links")
      .classList.remove("hidden");
    return;
  }
  document.getElementById("not-found-container-links").classList.add("hidden");

  // Get list container
  const linksList = document.getElementById("list-container-links");

  //Clear the list container of headers and lists from a potential previous run.
  document
    .querySelectorAll("#list-container-links h3, #list-container-links ul")
    .forEach((element) => {
      element.parentNode.removeChild(element);
    });

  // Add wrap class if option is set.
  if (optionsGlobal.wrapLists) {
    linksList.classList.add("wrap");
  }

  // For each bundle, create a header and the list of links.
  linksBundle.forEach((bundle) => {
    //Check for existing header
    let ul;
    let foundHeader = false;

    if (document.getElementById(`header-${bundle.title}`) != null) {
      // Header already exists, so list should already exist.
      ul = document.getElementById(`list-${bundle.title}`);
      foundHeader = true;
    } else {
      // Create header.
      const header = document.createElement("h3");
      header.setAttribute("class", "list-header list-header-links");
      header.setAttribute("id", `header-${bundle.title}`);
      header.textContent = bundle.title;
      linksList.appendChild(header);

      // Create list.
      ul = document.createElement("ul");
      ul.setAttribute("class", "list-links");
      ul.setAttribute("id", `list-${bundle.title}`);
      ul.setAttribute("data-title", bundle.title);
      ul.setAttribute("data-summary-type", bundle.links[0].summaryType);
    }
    // For each link in bundle, create a list item.
    bundle.links.forEach((link) => {
      // Create the list item.
      const li = document.createElement("li");
      li.setAttribute("class", "list-item-links");
      li.setAttribute("data-created-at", link.createdAt);
      li.setAttribute("data-summary-type", link.summaryType);
      li.setAttribute("data-source", link.source);

      // Create the scroll icon and append to list item, if there is a comment to scroll to.
      if (link.commentID != undefined || link.auditID != undefined) {
        const iScroll = document.createElement("i");
        iScroll.setAttribute("class", "icon-invert icon-li icon-search");
        iScroll.setAttribute("commentID", link.commentID);
        iScroll.setAttribute("auditID", link.auditID);
        iScroll.setAttribute("title", "Scroll to link's source comment.");
        li.appendChild(iScroll);
      }

      // Create the copy to markdown icon and append to list item.
      const iCopy = document.createElement("i");
      iCopy.setAttribute("class", "icon-invert icon-li icon-copy");
      iCopy.setAttribute("title", "Copy link to markdown.");
      li.appendChild(iCopy);

      // Add link content or parent context to list item.
      if (bundle.showParent) {
        // Parse the parent context as HTML and append to list item.
        // (Parent context is returned from Zendesk API as plain text)
        const parser = new DOMParser();
        const doc = parser.parseFromString(link.parent_text, "text/html");

        // Need to add `target="_blank"` to all links in the parent context.
        // Otherwise, they do not open in a tab.
        doc.querySelectorAll(`a`).forEach((a) => {
          a.setAttribute("target", "_blank");
          a.setAttribute(
            "title",
            `URL: ${a.href}\n\nComment created at: ${li.getAttribute(
              "data-created-at"
            )}\nLink source: ${li.getAttribute("data-source")}`
          );
        });

        // Get all the body because that's all we care about.
        const bodyNodes = doc.getElementsByTagName("body")[0].childNodes;

        // Get all the text nodes and wrap them in a span.
        let nodes = [];
        bodyNodes.forEach((node) => {
          if (node.nodeType == Node.TEXT_NODE) {
            const span = document.createElement("span");
            span.textContent = node.textContent;
            // span.setAttribute('class', 'link-context');
            nodes.push(span);
          } else {
            nodes.push(node);
          }
        });

        // Append all nodes to list item.
        const spanContext = document.createElement("span");
        spanContext.setAttribute("class", "link-context");
        spanContext.append(...nodes);
        li.append(spanContext);
      } else {
        const a = document.createElement("a");
        a.setAttribute("target", "_blank");
        a.setAttribute("href", link.href);
        a.setAttribute(
          "title",
          `URL: ${a.href}\n\nComment created at: ${li.getAttribute(
            "data-created-at"
          )}\nLink source: ${li.getAttribute("data-source")}`
        );
        a.textContent = link.text;
        li.appendChild(a);
      }
      ul.appendChild(li);
    });

    // Only append the ul to a header if it has not been done previously.
    if (!foundHeader) {
      linksList.appendChild(ul);
    }
  });

  // Add event listeners to icon for scrolling.
  document
    .getElementById("list-container-links")
    .querySelectorAll("i.icon-search")
    .forEach((i) => {
      i.addEventListener("click", () => {
        scrollToComment({
          commentID: i.getAttribute("commentID"),
          auditID: i.getAttribute("auditID"),
        });
      });
    });

  // Add event listeners to icon for copy.
  document
    .getElementById("list-container-links")
    .querySelectorAll("i.icon-copy")
    .forEach((i) => {
      i.addEventListener("click", () => {
        const href = i.parentElement.querySelector("a").href;
        const text = i.parentElement.textContent;
        writeLinkClipboard(text, href);
      });
    });

  // Add title attribute to custom field field icons.
  document
    .querySelectorAll('.list-item-links[data-source="custom field"]')
    .forEach((elem) => {
      elem.setAttribute("title", "This link was found in a custom field.");
    });
}

async function displayAttachments(attachmentsArr) {
  // If there are no attachments, display a message and return.
  if (attachmentsArr.length <= 0) {
    document
      .getElementById("not-found-container-attachments")
      .classList.remove("hidden");
    return;
  }
  document
    .getElementById("not-found-container-attachments")
    .classList.add("hidden");

  // Create and display attachments list.
  // Get attachments container.
  const attachmentsList = document.getElementById("list-container-attachments");

  //Clear the attachments container of headers and lists from a potential previous run.
  document
    .querySelectorAll(
      "#list-container-attachments h3, #list-container-attachments ul"
    )
    .forEach((element) => {
      element.parentNode.removeChild(element);
    });

  const ul = document.createElement("ul");
  ul.setAttribute("class", "list-attachments");

  // For each comment, create a top-level list item.
  attachmentsArr.forEach((comment) => {
    const liDate = document.createElement("li");
    liDate.setAttribute("class", "list-item-attachments");
    const txtDate = document.createTextNode(
      `Comment on: ${comment.created_at}`
    );

    // Create the icon and append to list item.
    const i = document.createElement("i");
    i.setAttribute("class", "icon-invert icon-li icon-search");
    i.setAttribute("commentID", comment.commentID);
    i.setAttribute("auditID", comment.auditID);
    liDate.append(i, txtDate);

    const ulComment = document.createElement("ul");
    ulComment.setAttribute("class", "list-attachments");

    // For each attachment, create a list item and append to top-level list item.
    comment.attachments.forEach((attachment) => {
      const liAttachment = document.createElement("li");
      liAttachment.setAttribute("class", "list-item-attachments");
      const aAttachment = document.createElement("a");
      aAttachment.setAttribute("target", "_blank");
      aAttachment.setAttribute("href", attachment.content_url);
      aAttachment.textContent = attachment.file_name;

      liAttachment.appendChild(aAttachment);
      ulComment.appendChild(liAttachment);
      liDate.appendChild(ulComment);
    });

    ul.appendChild(liDate);
    attachmentsList.appendChild(ul);
  });

  // Add event listeners to icon for scrolling.
  document
    .getElementById("list-container-attachments")
    .querySelectorAll("i")
    .forEach((i) => {
      i.addEventListener("click", () => {
        scrollToComment({
          commentID: i.getAttribute("commentID"),
          auditID: i.getAttribute("auditID"),
        });
      });
    });
}

// Implement logic to populate the "Images" tab with image previews
async function displayImages(imagesArr) {
  // If there are no images, display a message and return.
  if (imagesArr.length <= 0) {
    document
      .getElementById("not-found-container-images")
      .classList.remove("hidden");
    return;
  }
  document.getElementById("not-found-container-images").classList.add("hidden");

  // Get images container
  const imagesList = document.getElementById("list-container-images");

  // Clear the images container of previous content
  imagesList.innerHTML = "";

  const ul = document.createElement("ul");
  ul.setAttribute("class", "list-images");

  // For each image, create an image element and append to the container
  imagesArr.forEach((image) => {
    const li = document.createElement("li");
    li.setAttribute("class", "list-item-images");
    li.setAttribute("data-created-at", image.createdAt);
    li.setAttribute("data-summary-type", image.summaryType);
    li.setAttribute("data-source", image.source);

    // Create the scroll icon and append to list item, if there is a comment to scroll to.
    if (image.commentID != undefined || image.auditID != undefined) {
      const iScroll = document.createElement("i");
      iScroll.setAttribute("class", "icon-invert icon-li icon-search");
      iScroll.setAttribute("commentID", image.commentID);
      iScroll.setAttribute("auditID", image.auditID);
      iScroll.setAttribute("title", "Scroll to image's source comment.");
      li.appendChild(iScroll);
    }

    const img = document.createElement("img");
    img.src = image.url;
    img.alt = image.fileName;
    img.title = `Click to open in new tab\n\nFile: ${image.fileName}\nComment created at: ${image.createdAt}`;
    img.addEventListener("click", () => {
      // Send a message to the contentscript to click Zendesk's image preview button
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        browser.tabs.sendMessage(tabs[0].id, {
          type: "image-preview",
          imageTitle: image.fileName,
          imageURL: image.mappedURL,
        });
      });
    });

    li.appendChild(img);
    ul.appendChild(li);
  });

  // Append the list of images to the images container
  imagesList.appendChild(ul);

  // Add event listener to scroll to comment when scroll icon is clicked
  document
    .getElementById("list-container-images")
    .querySelectorAll("i.icon-search")
    .forEach((i) => {
      i.addEventListener("click", () => {
        scrollToComment({
          commentID: i.getAttribute("commentID"),
          auditID: i.getAttribute("auditID"),
        });
      });
    });
}

// Global options.
const optionsGlobal = {};
browser.storage.sync.get("optionsGlobal").then((data) => {
  if (data.optionsGlobal == undefined || data.optionsGlobal.length <= 0) {
    data.optionsGlobal = [];
  }
  optionsGlobal.wrapLists = data.optionsGlobal.wrapLists;
  optionsGlobal.backgroundProcessing = data.optionsGlobal.backgroundProcessing;
});

// Start the popup.
function start() {
  browser.storage.local.get("ticketStorage").then((data) => {
    // Something is wrong?
    if (data.ticketStorage == undefined || data.ticketStorage.length <= 0) {
      console.error(
        "Ticket storage doesn't look expected: ",
        data.ticketStorage
      );
      return;
    }
    console.log("Received ticket from storage: ", data.ticketStorage);
    document.getElementById("loader").classList.add("loading");
    document.getElementById("list-container-links").classList.add("hidden");

    // Display the links.
    displayLinks(data.ticketStorage.links);
    displayAttachments(data.ticketStorage.attachments);
    displayImages(data.ticketStorage.images);
    document
      .getElementById("button-refresh")
      .setAttribute(
        "title",
        `Refresh the ticket data immediately.` +
          `\n\nComments processed: ${data.ticketStorage.count}` +
          `\nTicket ID: ${data.ticketStorage.ticketID}` +
          `\nLast updated: ${new Date(data.ticketStorage.updatedAt)}`
      );

    document.getElementById("loader").classList.remove("loading");
    document.getElementById("list-container-links").classList.remove("hidden");
  });
}

// Send message to background script requesting refresh of ticketStorage.
function refresh() {
  //Clear the list container of headers and lists from a potential previous run.
  document
    .querySelectorAll("#list-container-links h3, #list-container-links ul")
    .forEach((element) => {
      element.parentNode.removeChild(element);
    });

  //Clear the attachments container of headers and lists from a potential previous run.
  document
    .querySelectorAll(
      "#list-container-attachments h3, #list-container-attachments ul"
    )
    .forEach((element) => {
      element.parentNode.removeChild(element);
    });

  browser.runtime.sendMessage({ type: "refresh" });
}

// Listen for changes to the ticketStorage.
// This means the background script has finished collecting links.
browser.storage.onChanged.addListener((changed) => {
  if (changed.ticketStorage == undefined) {
    return;
  }
  if (changed.ticketStorage.newValue.state == "complete") {
    start();
  } else if (changed.ticketStorage.newValue.state == "loading") {
    document.getElementById("loader").classList.add("loading");
    document.getElementById("list-container-links").classList.add("hidden");
  }
});

/*
 * ********************
 * * MAIN ENTRY POINT *
 * ********************
 * */
document.addEventListener("DOMContentLoaded", () => {
  // Start the popup.
  // If background processing is disabled, we have to also send a refresh request to get the current ticket.
  // Otherwise, the background script will have the new ticket already and we can directly start.
  browser.storage.sync.get("optionsGlobal").then((data) => {
    if (data.optionsGlobal.backgroundProcessing) {
      // Show that background processing is enabled.
      // Directly load from ticket storage.
      document.getElementById("background-processing").checked = true;
      start();
    } else {
      // Show that background processing is disabled.
      // Send refresh request to background script.
      document.getElementById("background-processing").checked = false;
      refresh();
    }
  });

  // Add event listeners to static elements.

  // Event listener for the open options link in the "not found" message.
  document
    .getElementById("not-found-link-patterns-options")
    .addEventListener("click", () => {
      browser.runtime.openOptionsPage();
    });

  // Event listener to open options when options button is clicked.
  document.getElementById("button-options").addEventListener("click", () => {
    browser.runtime.openOptionsPage();
  });

  // Event listener to copy summary to clipboard when summary button is clicked.
  document.getElementById("button-summary").addEventListener("click", () => {
    writeSummaryClipboard();
  });

  // Event listener to toggle background processing.
  document
    .getElementById("button-background-processing")
    .addEventListener("click", (event) => {
      const checkbox = document.getElementById("background-processing");
      browser.storage.sync.get("optionsGlobal").then((data) => {
        // If run in background is disabled, then enable it.
        if (!data.optionsGlobal.backgroundProcessing) {
          console.log("Enable background processing.");
          data.optionsGlobal.backgroundProcessing = true;
          browser.storage.sync
            .set({
              optionsGlobal: data.optionsGlobal,
            })
            .then(() => {
              checkbox.checked = true;
            });
          return;
        }
        // If run in background is enabled, then disable it.
        console.log("Disable background processing.");
        data.optionsGlobal.backgroundProcessing = false;
        browser.storage.sync
          .set({
            optionsGlobal: data.optionsGlobal,
          })
          .then(() => {
            checkbox.checked = false;
          });
      });
    });

  // Add event listener to the refresh button.
  document.getElementById("button-refresh").addEventListener("click", () => {
    refresh();
  });

  // Add event listeners to view swap buttons.
  // Links tab is clicked.
  document.getElementById("button-links").addEventListener("click", () => {
    document.getElementById("button-links").classList.add("checked");
    document.getElementById("list-container-links").classList.add("selected");
    document.querySelectorAll(".row-links").forEach((row) => {
      row.classList.add("selected");
    });

    document.getElementById("button-attachments").classList.remove("checked");
    document.getElementById("button-images").classList.remove("checked");
    document
      .getElementById("list-container-attachments")
      .classList.remove("selected");
    document
      .getElementById("list-container-images")
      .classList.remove("selected");
  });

  // Attachment tab is clicked.
  document
    .getElementById("button-attachments")
    .addEventListener("click", () => {
      document.getElementById("button-links").classList.remove("checked");
      document.getElementById("button-images").classList.remove("checked");
      document
        .getElementById("list-container-links")
        .classList.remove("selected");
      document
        .getElementById("list-container-images")
        .classList.remove("selected");
      document.querySelectorAll(".row-links").forEach((row) => {
        row.classList.remove("selected");
      });

      document.getElementById("button-attachments").classList.add("checked");
      document
        .getElementById("list-container-attachments")
        .classList.add("selected");
    });

  // Image tab is clicked.
  document.getElementById("button-images").addEventListener("click", () => {
    document.getElementById("button-images").classList.add("checked");
    document.getElementById("list-container-images").classList.add("selected");

    // Deselect other tabs
    document.getElementById("button-links").classList.remove("checked");
    document
      .getElementById("list-container-links")
      .classList.remove("selected");
    document.getElementById("button-attachments").classList.remove("checked");
    document
      .getElementById("list-container-attachments")
      .classList.remove("selected");

    // Hide summary and background processing options for images tab
    document.querySelectorAll(".row-links").forEach((row) => {
      row.classList.remove("selected");
    });
  });

  // Dynamically retrieve the version number from manifest.json and insert it into the "What's new?" button text.
  const manifestData = browser.runtime.getManifest();
  const version = manifestData.version;
  const whatsNewButton = document.getElementById("button-whats-new");
  whatsNewButton.textContent = `v${version}`;
  whatsNewButton.setAttribute(
    "href",
    `https://github.com/bagtoad/zendesk-link-collector/releases/tag/v${version}`
  );
});
