// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/// @title PizzaPOAP - soulbound attendance tokens for pizza dao community calls
/// @notice erc-721 tokens that are non-transferable (soulbound) to prevent farming.
///         each token proves a wallet attended a specific community call event.
contract PizzaPOAP is ERC721, Ownable {
    using Strings for uint256;

    // -------------------------------------------------------
    // structs
    // -------------------------------------------------------

    /// @notice represents a single community call event / drop
    struct Event {
        string name;        // e.g. "Pizza DAO Call #42"
        string description; // e.g. "Weekly community call"
        string imageURI;    // ipfs or https link to the event artwork
        uint256 eventDate;  // unix timestamp of the call
        uint256 mintCount;  // how many tokens minted for this event
        bool active;        // can still mint for this event?
    }

    // -------------------------------------------------------
    // state
    // -------------------------------------------------------

    /// @notice auto-incrementing token id counter
    uint256 private _nextTokenId;

    /// @notice auto-incrementing event id counter
    uint256 private _nextEventId;

    /// @notice eventId => Event data
    mapping(uint256 => Event) public events;

    /// @notice tokenId => eventId (which event does this token belong to?)
    mapping(uint256 => uint256) public tokenEvent;

    /// @notice eventId => wallet => bool (has this wallet been minted for this event?)
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    // -------------------------------------------------------
    // events (logs)
    // -------------------------------------------------------

    event EventCreated(uint256 indexed eventId, string name, uint256 eventDate);
    event AttendanceMinted(uint256 indexed eventId, address indexed attendee, uint256 tokenId);

    // -------------------------------------------------------
    // constructor
    // -------------------------------------------------------

    constructor() ERC721("PizzaPOAP", "PZPOAP") Ownable(msg.sender) {}

    // -------------------------------------------------------
    // admin: event management
    // -------------------------------------------------------

    /// @notice create a new event / drop that tokens can be minted for
    /// @param name display name for the event
    /// @param description short description of the event
    /// @param imageURI link to artwork (ipfs:// or https://)
    /// @param eventDate unix timestamp of when the call happened
    /// @return eventId the id of the newly created event
    function createEvent(
        string calldata name,
        string calldata description,
        string calldata imageURI,
        uint256 eventDate
    ) external onlyOwner returns (uint256 eventId) {
        eventId = _nextEventId++;

        events[eventId] = Event({
            name: name,
            description: description,
            imageURI: imageURI,
            eventDate: eventDate,
            mintCount: 0,
            active: true
        });

        emit EventCreated(eventId, name, eventDate);
    }

    /// @notice toggle whether an event can still accept mints
    function setEventActive(uint256 eventId, bool active) external onlyOwner {
        require(eventId < _nextEventId, "event does not exist");
        events[eventId].active = active;
    }

    // -------------------------------------------------------
    // admin: minting
    // -------------------------------------------------------

    /// @notice batch mint attendance tokens to a list of wallets for a given event.
    ///         skips any wallet that already claimed (no revert, just skip).
    /// @param eventId the event to mint for
    /// @param attendees list of wallet addresses to mint to
    /// @return minted number of tokens actually minted (skipped duplicates not counted)
    function batchMint(
        uint256 eventId,
        address[] calldata attendees
    ) external onlyOwner returns (uint256 minted) {
        require(eventId < _nextEventId, "event does not exist");
        require(events[eventId].active, "event is not active");

        for (uint256 i = 0; i < attendees.length; i++) {
            address attendee = attendees[i];

            // skip zero address and duplicates
            if (attendee == address(0) || hasClaimed[eventId][attendee]) {
                continue;
            }

            uint256 tokenId = _nextTokenId++;
            hasClaimed[eventId][attendee] = true;
            tokenEvent[tokenId] = eventId;
            events[eventId].mintCount++;

            _safeMint(attendee, tokenId);

            emit AttendanceMinted(eventId, attendee, tokenId);
            minted++;
        }
    }

    // -------------------------------------------------------
    // soulbound: block all transfers (except minting)
    // -------------------------------------------------------

    /// @notice override to make tokens soulbound -- only minting (from=0) is allowed
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // allow minting (from == address(0)), block everything else
        if (from != address(0)) {
            revert("PizzaPOAP: soulbound, transfers disabled");
        }

        return super._update(to, tokenId, auth);
    }

    // -------------------------------------------------------
    // metadata: on-chain json so no external server needed
    // -------------------------------------------------------

    /// @notice returns fully on-chain metadata as a base64-encoded json data uri
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // will revert if token doesn't exist (ownerOf check inside _requireOwned)
        _requireOwned(tokenId);

        uint256 eventId = tokenEvent[tokenId];
        Event storage evt = events[eventId];

        // build json metadata on-chain
        string memory json = string(
            abi.encodePacked(
                '{"name":"', evt.name, ' #', tokenId.toString(), '",',
                '"description":"', evt.description, '",',
                '"image":"', evt.imageURI, '",',
                '"attributes":[',
                    '{"trait_type":"Event","value":"', evt.name, '"},',
                    '{"trait_type":"Event ID","value":"', eventId.toString(), '"},',
                    '{"trait_type":"Event Date","value":"', evt.eventDate.toString(), '"},',
                    '{"trait_type":"Soulbound","value":"true"}',
                ']}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    // -------------------------------------------------------
    // view helpers
    // -------------------------------------------------------

    /// @notice total tokens minted across all events
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice total events created
    function totalEvents() external view returns (uint256) {
        return _nextEventId;
    }
}
