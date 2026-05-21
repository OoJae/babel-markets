// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Babel Markets AttributionEscrow. Phase 5 deliverable.
// Holds swept USDC, records each creator's accrued balance, and releases payouts on
// a weekly cadence. Takes a 20 percent platform fee.
//
// Deployed on Arc testnet. Uses Arc's Paymaster v0.8 so creators never need a gas token;
// fees are paid in USDC.

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract AttributionEscrow {
    address public owner;
    address public usdc;
    uint16 public constant PLATFORM_FEE_BPS = 2000; // 20%

    mapping(address => uint256) public accrued;
    mapping(bytes32 => address) public questionCreator;

    event FeesCredited(bytes32 indexed questionId, address indexed creator, uint256 amount);
    event Payout(address indexed creator, uint256 amount);

    error NotOwner();
    error NothingToClaim();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _usdc) {
        owner = msg.sender;
        usdc = _usdc;
    }

    function registerQuestion(bytes32 questionId, address creator) external onlyOwner {
        questionCreator[questionId] = creator;
    }

    function creditFees(bytes32 questionId, uint256 amount) external onlyOwner {
        address creator = questionCreator[questionId];
        require(creator != address(0), "unknown question");
        uint256 platformCut = (amount * PLATFORM_FEE_BPS) / 10_000;
        uint256 creatorCut = amount - platformCut;
        accrued[creator] += creatorCut;
        accrued[owner] += platformCut;
        emit FeesCredited(questionId, creator, creatorCut);
    }

    function claim() external {
        uint256 owed = accrued[msg.sender];
        if (owed == 0) revert NothingToClaim();
        accrued[msg.sender] = 0;
        require(IERC20(usdc).transfer(msg.sender, owed), "transfer failed");
        emit Payout(msg.sender, owed);
    }

    function payoutBatch(address[] calldata creators) external onlyOwner {
        for (uint256 i = 0; i < creators.length; ++i) {
            uint256 owed = accrued[creators[i]];
            if (owed == 0) continue;
            accrued[creators[i]] = 0;
            require(IERC20(usdc).transfer(creators[i], owed), "transfer failed");
            emit Payout(creators[i], owed);
        }
    }
}
